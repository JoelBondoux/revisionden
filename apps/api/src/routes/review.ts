import { Hono, type Context, type Next } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  batchOutcome,
  createRng,
  drawSample,
  needsIndividualReview,
  readyForHumanReview,
  recheckedSince,
  samplingRule,
  type ReviewDecision,
} from '@revisionden/core';
import {
  itemReports,
  items,
  recalculationJobs,
  recheckRequests,
  reviewBatches,
  reviewBatchItems,
  reviewerRoles,
  REVIEWER_ROLES,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import { ContentIdSchema, quarantine, releaseIfNoOpenReports } from './quarantine';

export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

export interface ConfirmedError {
  itemId: string;
  itemVersion: number;
}

export interface VerificationDeps {
  /** Seed for each batch sample (recorded with the batch so the draw can be replayed). */
  randomSeed?: () => number;
  /**
   * Called after a confirmed error, once the recalculation job is queued. The learning loop
   * plugs in here to recalculate affected students' scores and mastery.
   */
  onConfirmedError?: (error: ConfirmedError) => Promise<void>;
}

type ReviewEnv = AppEnv & { Variables: AppEnv['Variables'] & { reviewerRole: ReviewerRole } };

const Notes = z.string().trim().max(1000).optional();
const DecideReportSchema = z
  .object({ decision: z.enum(['no_error', 'confirmed_error']), notes: Notes })
  .strict();
const DecideItemSchema = z
  .object({ decision: z.enum(['approved', 'confirmed_error']), notes: Notes })
  .strict();
const CreateBatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    writerPrompt: z.string().trim().min(1).max(200).optional(),
    sourceUrl: z.string().url().startsWith('https://').optional(),
    items: z
      .array(
        z
          .object({
            itemId: ContentIdSchema,
            itemVersion: z.number().int().min(1),
            needsHumanApproval: z.boolean().default(false),
            snapshot: z.record(z.unknown()),
          })
          .strict(),
      )
      .min(1)
      .max(5000)
      .refine((items) => new Set(items.map((i) => i.itemId)).size === items.length, {
        message: 'each item may appear only once in a batch',
      }),
  })
  .strict();
const FromDraftsSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();
type CreateBatchInput = z.infer<typeof CreateBatchSchema>;
const CreateRecheckSchema = z
  .object({
    scope: z.enum(['batch', 'item', 'writer_prompt', 'source']),
    scopeValue: z.string().trim().min(1).max(500),
    cause: z.string().trim().min(1).max(500),
  })
  .strict();
const ReportStatus = z.enum(['open', 'no_error', 'confirmed_error']).optional();
const JobStatus = z.enum(['pending', 'done']).optional();

const conflict = (message: string) => new ApiError(409, 'conflict', message);
const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

/** Reviewer routes under /v1/review. Every decision is recorded by role, never by name. */
export function reviewRoutes(db: Database, deps: VerificationDeps & { now: () => Date }) {
  const app = new Hono<ReviewEnv>();
  const randomSeed =
    deps.randomSeed ?? (() => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1);

  app.use('*', async (c: Context<ReviewEnv>, next: Next) => {
    const [row] = await db
      .select({ role: reviewerRoles.role })
      .from(reviewerRoles)
      .where(eq(reviewerRoles.authUserId, c.var.parent.authUserId));
    if (!row) throw new ApiError(403, 'forbidden', 'Only reviewers can use the review queue');
    c.set('reviewerRole', row.role);
    await next();
  });

  async function recheck(
    scope: 'batch' | 'item' | 'writer_prompt' | 'source',
    scopeValue: string,
    cause: string,
  ) {
    await db.insert(recheckRequests).values({ scope, scopeValue, cause });
  }

  async function confirmedError(error: ConfirmedError, cause: string) {
    await quarantine(db, error.itemId, error.itemVersion, 'confirmed_error');
    await db.insert(recalculationJobs).values(error);
    await recheck('item', error.itemId, cause);
    await deps.onConfirmedError?.(error);
  }

  app.get('/me', (c) => c.json({ role: c.var.reviewerRole }));

  // ---- Reports ------------------------------------------------------------------------------

  app.get('/reports', async (c) => {
    const status = ReportStatus.parse(c.req.query('status'));
    const item = c.req.query('item');
    const where = and(
      status ? eq(itemReports.status, status) : undefined,
      item ? eq(itemReports.itemId, ContentIdSchema.parse(item)) : undefined,
    );
    const rows = await db
      .select({
        id: itemReports.id,
        itemId: itemReports.itemId,
        itemVersion: itemReports.itemVersion,
        reason: itemReports.reason,
        reportedBy: itemReports.reportedBy,
        status: itemReports.status,
        reportedAt: itemReports.createdAt,
        decidedAt: itemReports.decidedAt,
        decidedByRole: itemReports.decidedByRole,
        decisionNotes: itemReports.decisionNotes,
      })
      .from(itemReports)
      .where(where)
      .orderBy(asc(itemReports.createdAt));
    return c.json({ reports: rows });
  });

  app.post('/reports/:id/decision', async (c) => {
    const id = c.req.param('id');
    const input = await readJson(c, DecideReportSchema);
    const [report] = isUuid(id)
      ? await db.select().from(itemReports).where(eq(itemReports.id, id))
      : [];
    if (!report) throw notFound('No such report');
    if (report.status !== 'open') throw conflict('This report has already been decided');
    await db
      .update(itemReports)
      .set({
        status: input.decision,
        decidedByRole: c.var.reviewerRole,
        decisionNotes: input.notes ?? null,
        decidedAt: deps.now(),
      })
      .where(eq(itemReports.id, id));
    if (input.decision === 'no_error') {
      await releaseIfNoOpenReports(db, report.itemId, id);
    } else {
      await confirmedError(
        { itemId: report.itemId, itemVersion: report.itemVersion },
        `confirmed error from report ${id}`,
      );
    }
    return c.json({ id, status: input.decision });
  });

  // ---- Batches ------------------------------------------------------------------------------

  async function createBatch(parsed: CreateBatchInput) {
    // Extended answers always need individual human approval (docs/VERIFICATION.md section 3).
    const input = {
      ...parsed,
      items: parsed.items.map((i) => ({
        ...i,
        needsHumanApproval: i.needsHumanApproval || i.snapshot.type === 'extended_answer',
      })),
    };
    // Decision 0010: 3% (at least 10) only when every item is from an approved template whose
    // cross-check passed; any other batch keeps 10% (at least 30). The rule follows from the item
    // snapshots stored with the batch, so a replay of the seed gives the same sample.
    const rule = samplingRule(input.items.map((i) => i.snapshot));
    const sampleSeed = randomSeed();
    const sample = new Set(drawSample(input.items, createRng(sampleSeed), rule));
    const [batch] = await db
      .insert(reviewBatches)
      .values({
        title: input.title,
        writerPrompt: input.writerPrompt ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sampleSeed,
      })
      .returning();
    await db.insert(reviewBatchItems).values(
      input.items.map((i) => ({
        batchId: batch!.id,
        itemId: i.itemId,
        itemVersion: i.itemVersion,
        needsHumanApproval: i.needsHumanApproval,
        inSample: sample.has(i.itemId),
        snapshot: i.snapshot,
      })),
    );
    return {
      id: batch!.id,
      size: input.items.length,
      samplingRule: rule,
      sampleSize: sample.size,
      sample: [...sample],
    };
  }

  app.post('/batches', async (c) => {
    return c.json(await createBatch(await readJson(c, CreateBatchSchema)), 201);
  });

  /**
   * Draft items ready for a person (workstream S2): every automated check passed in the synced
   * snapshot, and that version is not already in a batch under review or passed.
   */
  async function readyDrafts() {
    const rows = await db
      .select({ itemId: items.contentId, version: items.version, snapshot: items.reviewSnapshot })
      .from(items)
      .where(eq(items.status, 'draft'))
      .orderBy(asc(items.contentId));
    const memberships = await db
      .select({
        batchId: reviewBatches.id,
        status: reviewBatches.status,
        decidedAt: reviewBatches.decidedAt,
        itemId: reviewBatchItems.itemId,
        itemVersion: reviewBatchItems.itemVersion,
      })
      .from(reviewBatchItems)
      .innerJoin(reviewBatches, eq(reviewBatches.id, reviewBatchItems.batchId));
    const openRechecks = await db
      .select({ batchId: recheckRequests.scopeValue })
      .from(recheckRequests)
      .where(and(eq(recheckRequests.scope, 'batch'), eq(recheckRequests.status, 'pending')));
    const pendingBatches = new Set(openRechecks.map((r) => r.batchId));
    const byItem = new Map<string, typeof memberships>();
    for (const m of memberships) {
      const key = `${m.itemId}@${m.itemVersion}`;
      byItem.set(key, [...(byItem.get(key) ?? []), m]);
    }
    // An item version is blocked while it is in a batch under review or passed, and after a failed
    // batch until that batch's recheck is done and steps 3 to 5 have re-run since the failure.
    const blocked = (key: string, snapshot: Record<string, unknown>) =>
      (byItem.get(key) ?? []).some((m) =>
        m.status === 'failed'
          ? pendingBatches.has(m.batchId) || !m.decidedAt || !recheckedSince(snapshot, m.decidedAt)
          : true,
      );
    return rows.flatMap(({ itemId, version, snapshot }) =>
      itemId &&
      snapshot &&
      readyForHumanReview(snapshot) &&
      !blocked(`${itemId}@${version}`, snapshot)
        ? [
            {
              itemId,
              itemVersion: version,
              needsHumanApproval: needsIndividualReview(snapshot),
              snapshot,
            },
          ]
        : [],
    );
  }

  app.get('/batches/from-drafts', async (c) => c.json({ ready: (await readyDrafts()).length }));

  app.post('/batches/from-drafts', async (c) => {
    if (c.var.reviewerRole !== 'content-lead') {
      throw new ApiError(403, 'forbidden', 'Only a content lead can create a batch');
    }
    const { title } = await readJson(c, FromDraftsSchema);
    const ready = await readyDrafts();
    if (ready.length === 0) throw conflict('No draft items are ready for review');
    return c.json(await createBatch({ title, items: ready }), 201);
  });

  app.get('/batches', async (c) => {
    const rows = await db
      .select({
        id: reviewBatches.id,
        title: reviewBatches.title,
        status: reviewBatches.status,
        createdAt: reviewBatches.createdAt,
        size: sql<number>`count(*)::int`,
        sampleSize: sql<number>`count(*) filter (where ${reviewBatchItems.inSample})::int`,
        decided: sql<number>`count(${reviewBatchItems.decision})::int`,
      })
      .from(reviewBatches)
      .innerJoin(reviewBatchItems, eq(reviewBatchItems.batchId, reviewBatches.id))
      .groupBy(reviewBatches.id)
      .orderBy(desc(reviewBatches.createdAt));
    return c.json({ batches: rows });
  });

  async function findBatch(id: string) {
    const [batch] = isUuid(id)
      ? await db.select().from(reviewBatches).where(eq(reviewBatches.id, id))
      : [];
    if (!batch) throw notFound('No such batch');
    return batch;
  }

  const sampleOf = (batchId: string) =>
    db
      .select({
        itemId: reviewBatchItems.itemId,
        itemVersion: reviewBatchItems.itemVersion,
        needsHumanApproval: reviewBatchItems.needsHumanApproval,
        snapshot: reviewBatchItems.snapshot,
        decision: reviewBatchItems.decision,
        decidedByRole: reviewBatchItems.decidedByRole,
        decisionNotes: reviewBatchItems.decisionNotes,
        decidedAt: reviewBatchItems.decidedAt,
      })
      .from(reviewBatchItems)
      .where(and(eq(reviewBatchItems.batchId, batchId), eq(reviewBatchItems.inSample, true)))
      .orderBy(asc(reviewBatchItems.itemId));

  app.get('/batches/:id', async (c) => {
    const batch = await findBatch(c.req.param('id'));
    return c.json({
      id: batch.id,
      title: batch.title,
      status: batch.status,
      sampleSeed: batch.sampleSeed,
      createdAt: batch.createdAt,
      decidedAt: batch.decidedAt,
      items: await sampleOf(batch.id),
    });
  });

  app.post('/batches/:id/items/:itemId/decision', async (c) => {
    const batch = await findBatch(c.req.param('id'));
    const itemId = ContentIdSchema.parse(c.req.param('itemId'));
    const input = await readJson(c, DecideItemSchema);
    if (batch.status !== 'in_review') throw conflict(`This batch has already ${batch.status}`);
    const [entry] = await db
      .select()
      .from(reviewBatchItems)
      .where(and(eq(reviewBatchItems.batchId, batch.id), eq(reviewBatchItems.itemId, itemId)));
    if (!entry) throw notFound('That item is not in this batch');
    if (!entry.inSample) throw conflict('That item is not in the review sample');
    await db
      .update(reviewBatchItems)
      .set({
        decision: input.decision,
        decidedByRole: c.var.reviewerRole,
        decisionNotes: input.notes ?? null,
        decidedAt: deps.now(),
      })
      .where(and(eq(reviewBatchItems.batchId, batch.id), eq(reviewBatchItems.itemId, itemId)));

    const decisions = (await sampleOf(batch.id)).map((i) => i.decision as ReviewDecision | null);
    const status = batchOutcome(decisions);
    if (status !== 'in_review') {
      await db
        .update(reviewBatches)
        .set({ status, decidedAt: deps.now() })
        .where(eq(reviewBatches.id, batch.id));
    }
    if (status === 'failed') {
      const cause = `confirmed error in ${itemId} (batch ${batch.title})`;
      await recheck('batch', batch.id, `${cause}: re-run steps 3 to 5 and draw a fresh sample`);
      if (batch.writerPrompt) await recheck('writer_prompt', batch.writerPrompt, cause);
      if (batch.sourceUrl) await recheck('source', batch.sourceUrl, cause);
    }
    return c.json({ itemId, decision: input.decision, status });
  });

  // ---- Re-checks and recalculation ---------------------------------------------------------

  app.get('/rechecks', async (c) => {
    const status = JobStatus.parse(c.req.query('status'));
    const rows = await db
      .select()
      .from(recheckRequests)
      .where(status ? eq(recheckRequests.status, status) : undefined)
      .orderBy(asc(recheckRequests.createdAt));
    return c.json({ rechecks: rows });
  });

  app.post('/rechecks', async (c) => {
    const input = await readJson(c, CreateRecheckSchema);
    const [row] = await db.insert(recheckRequests).values(input).returning();
    return c.json(row, 201);
  });

  const markDone =
    (table: typeof recheckRequests | typeof recalculationJobs) => async (c: Context) => {
      const id = c.req.param('id')!;
      const rows = isUuid(id)
        ? await db
            .update(table)
            .set({ status: 'done', completedAt: deps.now() })
            .where(and(eq(table.id, id), eq(table.status, 'pending')))
            .returning({ id: table.id })
        : [];
      if (rows.length === 0) throw notFound('Nothing pending with that id');
      return c.json({ id, status: 'done' });
    };
  app.post('/rechecks/:id/done', markDone(recheckRequests));

  app.get('/recalculations', async (c) => {
    const status = JobStatus.parse(c.req.query('status'));
    const rows = await db
      .select()
      .from(recalculationJobs)
      .where(status ? eq(recalculationJobs.status, status) : undefined)
      .orderBy(asc(recalculationJobs.createdAt));
    return c.json({ jobs: rows });
  });
  app.post('/recalculations/:id/done', markDone(recalculationJobs));

  return app;
}
