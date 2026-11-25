/**
 * Daily limit routes (workstream K7, docs/PRODUCT_RULES.md "Daily limit (wellbeing)").
 * - Parent (any parent of the family): GET and PUT /v1/students/:id/daily-limit, and
 *   POST /v1/students/:id/daily-limit/suggestion to accept or dismiss the weekly suggestion.
 * - Student device: GET /v1/student/daily-limit (limit, minutes left, change notice) and
 *   POST /v1/student/daily-limit/seen once the change notice has been shown.
 */
import { Hono } from 'hono';
import {
  DailyLimitSuggestionActionSchema,
  UpdateDailyLimitRequestSchema,
  applySuggestion,
} from '@revisionden/core';
import type { Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import {
  dismissSuggestion,
  loadLimitContext,
  markSeen,
  parentView,
  saveLimits,
  studentView,
} from './state';

interface Deps {
  db: Database;
  clock: Clock;
}

/** Mounted under /v1/students, after the parent session check. */
export function parentDailyLimitRoutes({ db, clock }: Deps) {
  const app = new Hono<AppEnv>();
  const own = (familyId: string, id: string) => requireFamilyStudent(db, familyId, id);

  app.get('/:id/daily-limit', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    return c.json(await parentView(db, student.id, clock.now()));
  });

  app.put('/:id/daily-limit', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    const change = await readJson(c, UpdateDailyLimitRequestSchema);
    const now = clock.now();
    await saveLimits(db, student.id, change, now);
    return c.json(await parentView(db, student.id, now));
  });

  app.post('/:id/daily-limit/suggestion', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    const { action } = await readJson(c, DailyLimitSuggestionActionSchema);
    const now = clock.now();
    const ctx = await loadLimitContext(db, student.id);
    const suggestion = ctx.row?.pendingSuggestion;
    if (!suggestion) {
      throw new ApiError(409, 'no_suggestion', 'There is no suggestion waiting');
    }
    if (action === 'accept') {
      const next = applySuggestion(ctx.settings, suggestion);
      await saveLimits(db, student.id, next, now, { clearSuggestion: true });
    } else {
      await dismissSuggestion(db, student.id, now);
    }
    return c.json(await parentView(db, student.id, now));
  });

  return app;
}

/** Mounted under /v1/student, after the student session check. */
export function studentDailyLimitRoutes({ db, clock }: Deps) {
  const app = new Hono<AppEnv>();
  app.get('/daily-limit', async (c) =>
    c.json(await studentView(db, c.var.student.studentId, clock.now())),
  );
  app.post('/daily-limit/seen', async (c) => {
    await markSeen(db, c.var.student.studentId, clock.now());
    return c.body(null, 204);
  });
  return app;
}
