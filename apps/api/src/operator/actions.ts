/**
 * O3: operator actions from AppDeck (`docs/OPERATOR_CONSOLE.md`), on AppDeck's paths. Every
 * change is audited and answers `{ ok: true }`. Bug confirming, Not a bug (L13) and status
 * changes reuse the feedback code (workstream L), so the Bug Hunter rewards and the bug button
 * rest follow the same rules.
 */
import { Hono, type Context } from 'hono';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  OperatorDuplicateBodySchema,
  OperatorNoteBodySchema,
  OperatorReplyBodySchema,
  OperatorTicketStatusBodySchema,
} from '@revisionden/core';
import { families, feedback, feedbackReplies, operatorNotes, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import {
  confirmFeedback,
  markNotABug,
  setFeedbackStatus,
  switchBugButtonOn,
} from '../feedback/routes';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { audit, ok } from './bridge';

export interface OperatorActionDeps {
  db: Database;
  clock: Clock;
}

/** Reads and checks a change body; anything else is 400. */
async function body<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, 'invalid_request', 'The request is not valid');
  return parsed.data;
}

export function operatorActionRoutes({ db, clock }: OperatorActionDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  async function ticketFamily(id: string): Promise<string> {
    if (!isId(id)) throw notFound('Ticket not found');
    const [row] = await db
      .select({ familyId: feedback.familyId })
      .from(feedback)
      .where(eq(feedback.id, id));
    if (!row) throw notFound('Ticket not found');
    return row.familyId;
  }

  const audited = (c: Context<AppEnv>, action: string, familyId: string) =>
    audit(db, c.var.operator, { action, targetType: 'family', targetId: familyId }, now());

  app.post('/families/:id/notes', async (c) => {
    const id = c.req.param('id');
    const { text } = await body(c, OperatorNoteBodySchema);
    if (!isId(id)) throw notFound('Family not found');
    const [family] = await db.select({ id: families.id }).from(families).where(eq(families.id, id));
    if (!family) throw notFound('Family not found');
    await db
      .insert(operatorNotes)
      .values({ familyId: id, authorEmail: c.var.operator.email, text, createdAt: now() });
    await audited(c, 'note.add', id);
    return ok(c, { ok: true });
  });

  app.post('/tickets/:id/reply', async (c) => {
    const id = c.req.param('id');
    const { text } = await body(c, OperatorReplyBodySchema);
    const familyId = await ticketFamily(id);
    await db
      .insert(feedbackReplies)
      .values({ feedbackId: id, authorEmail: c.var.operator.email, body: text, createdAt: now() });
    await audited(c, 'ticket.reply', familyId);
    return ok(c, { ok: true });
  });

  app.post('/tickets/:id/status', async (c) => {
    const { status } = await body(c, OperatorTicketStatusBodySchema);
    const row = await setFeedbackStatus(db, now(), c.req.param('id'), status);
    await audited(c, 'ticket.status', row.familyId);
    return ok(c, { ok: true });
  });

  app.post('/tickets/:id/confirm-bug', async (c) => {
    const { item } = await confirmFeedback(db, now(), c.req.param('id'));
    await audited(c, 'ticket.confirm_bug', item.familyId);
    return ok(c, { ok: true });
  });

  // L13: a bug report that is not a bug; three in 14 days rest the student's bug button.
  app.post('/tickets/:id/not-a-bug', async (c) => {
    const item = await markNotABug(db, now(), c.req.param('id'));
    await audited(c, 'ticket.not_a_bug', item.familyId);
    return ok(c, { ok: true });
  });

  // L13: switches the ticket sender's bug button back on (a rest or a removal).
  app.post('/tickets/:id/bug-button-on', async (c) => {
    const id = c.req.param('id');
    if (!isId(id)) throw notFound('Ticket not found');
    const [row] = await db
      .select({ familyId: feedback.familyId, studentId: feedback.studentId })
      .from(feedback)
      .where(eq(feedback.id, id));
    if (!row) throw notFound('Ticket not found');
    if (!row.studentId) {
      throw new ApiError(
        400,
        'not_a_student_ticket',
        'Only a student has a bug button to switch on.',
      );
    }
    await switchBugButtonOn(db, row.studentId, now());
    await audited(c, 'ticket.bug_button_on', row.familyId);
    return ok(c, { ok: true });
  });

  app.post('/tickets/:id/duplicate', async (c) => {
    const { duplicateOf } = await body(c, OperatorDuplicateBodySchema);
    const { item } = await confirmFeedback(db, now(), c.req.param('id'), duplicateOf);
    await audited(c, 'ticket.duplicate', item.familyId);
    return ok(c, { ok: true });
  });

  return app;
}
