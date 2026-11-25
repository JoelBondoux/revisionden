import { Hono } from 'hono';
import { and, count, eq, gte, sum } from 'drizzle-orm';
import { z } from 'zod';
import { aiUsage, items, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { aiAllowanceFor, monthStart, type AiGateway } from './gateway';
import { toShortAnswerQuestion } from './items';
import { MAX_ANSWER_LENGTH, markShortAnswer } from './marking';

export interface AiRouteDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
  gateway: AiGateway;
}

// TODO(workstream C): move this request schema into packages/core.
const markSchema = z
  .object({ itemId: z.string(), answer: z.string().max(MAX_ANSWER_LENGTH) })
  .strict();

/** Student device routes under /v1/ai (the student session is checked by the caller). */
export function aiRoutes({ db, gateway }: AiRouteDeps) {
  const app = new Hono<AppEnv>();

  app.post('/mark-short-answer', async (c) => {
    const { itemId, answer } = await readJson(c, markSchema);
    if (!isId(itemId)) throw notFound('Question not found');
    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    if (!item) throw notFound('Question not found');
    const question = toShortAnswerQuestion(item);
    if (!question) {
      throw new ApiError(400, 'not_short_answer', 'This question cannot be marked this way.');
    }
    return c.json(
      await markShortAnswer({ question, answer, studentId: c.var.student.studentId, gateway }),
    );
  });

  return app;
}

/**
 * Parent route under /v1/students: this month's AI marking allowance for one student, as a share
 * used and the reset date. No money ever goes to a family client (K9); the raw cost stays in
 * operator routes.
 */
export function parentAiUsageRoutes({ db, config, clock }: AiRouteDeps) {
  const app = new Hono<AppEnv>();
  app.get('/:id/ai-usage', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const start = monthStart(clock.now());
    const [row] = await db
      .select({ calls: count(), spent: sum(aiUsage.costMicroUsd) })
      .from(aiUsage)
      .where(and(eq(aiUsage.studentId, student.id), gte(aiUsage.createdAt, start)));
    const allowance = aiAllowanceFor(start, Number(row?.spent ?? 0), config.ai.monthlyCapMicroUsd);
    return c.json({
      month: start.toISOString().slice(0, 7),
      calls: Number(row?.calls ?? 0),
      allowanceUsedPercent: allowance.percentUsed,
      usedUp: allowance.usedUp,
      resetsOn: allowance.resetsOn,
    });
  });
  return app;
}
