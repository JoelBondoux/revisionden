/**
 * "Worth a look together" (workstream K11), parent only and read-only:
 * - GET /v1/students/:id/worth-a-look: topics with learning points F5 has flagged after
 *   repeated misses across days, one entry per topic. Never served to the child's device.
 */
import { Hono } from 'hono';
import { groupWorthALook } from '@revisionden/core';
import type { Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { requireFamilyStudent } from '../families';
import { worthALook } from '../learning/mistakes';

/** Mounted under /v1/students, after the parent session check. */
export function worthALookRoutes(deps: { db: Database }) {
  const app = new Hono<AppEnv>();
  app.get('/:id/worth-a-look', async (c) => {
    const student = await requireFamilyStudent(deps.db, c.var.parent.familyId, c.req.param('id'));
    return c.json(groupWorthALook(await worthALook(deps.db, student.id)));
  });
  return app;
}
