/**
 * O6: family tags (`docs/OPERATOR_CONSOLE.md` "Family tags"). Managers create, edit and retire
 * tags; Agents add and remove them on a family and list a tag's families (the only list view).
 * Tags are internal: families see only the beta programme, which they can leave.
 */
import { Hono, type Context } from 'hono';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  FamilyTagBodySchema,
  NO_FAMILY_EFFECTS,
  familyEffects,
  type FamilyTagEffects,
} from '@revisionden/core';
import {
  authUsers,
  families,
  familyTagLinks,
  familyTags,
  parents,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { isUniqueViolation } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { audit, ok, requireManager } from './bridge';

export interface OperatorTagDeps {
  db: Database;
  clock: Clock;
}

type TagRow = typeof familyTags.$inferSelect;

const effectsOf = (t: TagRow): FamilyTagEffects => ({
  betaProgramme: t.betaProgramme,
  earlyAccess: t.earlyAccess,
  complimentaryPremium: t.complimentaryPremium,
  excludeFromMetrics: t.excludeFromMetrics,
});

const tagRef = (t: TagRow) => ({ id: t.id, name: t.name, colour: t.colour });

/** Live (not retired) tags per family, as `{ id, name, colour }`. */
export async function liveTagsFor(db: Database, familyIds: string[]) {
  const map = new Map<string, { id: string; name: string; colour: string }[]>();
  if (familyIds.length === 0) return map;
  const rows = await db
    .select({ familyId: familyTagLinks.familyId, tag: familyTags })
    .from(familyTagLinks)
    .innerJoin(familyTags, eq(familyTags.id, familyTagLinks.tagId))
    .where(and(inArray(familyTagLinks.familyId, familyIds), isNull(familyTags.retiredAt)))
    .orderBy(familyTags.name);
  for (const r of rows) map.set(r.familyId, [...(map.get(r.familyId) ?? []), tagRef(r.tag)]);
  return map;
}

/** A family's effects from its live tags: for feature flags, payments ($) and metrics. */
export async function effectsForFamily(db: Database, familyId: string): Promise<FamilyTagEffects> {
  const rows = await db
    .select({ tag: familyTags })
    .from(familyTagLinks)
    .innerJoin(familyTags, eq(familyTags.id, familyTagLinks.tagId))
    .where(eq(familyTagLinks.familyId, familyId));
  if (rows.length === 0) return NO_FAMILY_EFFECTS;
  return familyEffects(
    rows.map((r) => ({ effects: effectsOf(r.tag), retired: !!r.tag.retiredAt })),
  );
}

/** Families left out of the overview numbers (a live "exclude from metrics" tag). */
export async function familiesExcludedFromMetrics(db: Database): Promise<string[]> {
  const rows = await db
    .selectDistinct({ familyId: familyTagLinks.familyId })
    .from(familyTagLinks)
    .innerJoin(familyTags, eq(familyTags.id, familyTagLinks.tagId))
    .where(and(eq(familyTags.excludeFromMetrics, true), isNull(familyTags.retiredAt)));
  return rows.map((r) => r.familyId);
}

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

const tagTaken = () => new ApiError(409, 'tag_taken', 'A tag with that name already exists');

export function operatorTagRoutes({ db, clock }: OperatorTagDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();
  const auditTag = (c: Context<AppEnv>, action: string, id: string) =>
    audit(db, c.var.operator, { action, targetType: 'tag', targetId: id }, now());

  async function findTag(id: string): Promise<TagRow> {
    if (!isId(id)) throw notFound('Tag not found');
    const [tag] = await db.select().from(familyTags).where(eq(familyTags.id, id));
    if (!tag) throw notFound('Tag not found');
    return tag;
  }

  app.get('/tags', async (c) => {
    const rows = await db.select().from(familyTags).orderBy(familyTags.name);
    const counts = await db
      .select({ tagId: familyTagLinks.tagId, n: count() })
      .from(familyTagLinks)
      .groupBy(familyTagLinks.tagId);
    const used = new Map(counts.map((r) => [r.tagId, r.n]));
    return ok(c, {
      tags: rows.map((t) => ({
        ...tagRef(t),
        description: t.description,
        effects: effectsOf(t),
        familyCount: used.get(t.id) ?? 0,
        retiredAt: t.retiredAt?.toISOString() ?? null,
      })),
    });
  });

  app.post('/tags', requireManager(db), async (c) => {
    const { name, colour, description, effects } = await body(c, FamilyTagBodySchema);
    let tag: TagRow;
    try {
      [tag] = (await db
        .insert(familyTags)
        .values({
          name,
          colour,
          description,
          ...effects,
          createdBy: c.var.operator.email,
          createdAt: now(),
        })
        .returning()) as [TagRow];
    } catch (err) {
      if (isUniqueViolation(err, 'family_tags_name_unique')) throw tagTaken();
      throw err;
    }
    await auditTag(c, 'tag.create', tag.id);
    return ok(c, {
      tag: {
        ...tagRef(tag),
        description,
        effects: effectsOf(tag),
        familyCount: 0,
        retiredAt: null,
      },
    });
  });

  app.post('/tags/:id/retire', requireManager(db), async (c) => {
    const tag = await findTag(c.req.param('id'));
    if (!tag.retiredAt) {
      await db.update(familyTags).set({ retiredAt: now() }).where(eq(familyTags.id, tag.id));
    }
    await auditTag(c, 'tag.retire', tag.id);
    return ok(c, { ok: true });
  });

  // Rename or edit a tag (same body as creating one).
  app.post('/tags/:id', requireManager(db), async (c) => {
    const { name, colour, description, effects } = await body(c, FamilyTagBodySchema);
    const tag = await findTag(c.req.param('id'));
    try {
      await db
        .update(familyTags)
        .set({ name, colour, description, ...effects })
        .where(eq(familyTags.id, tag.id));
    } catch (err) {
      if (isUniqueViolation(err, 'family_tags_name_unique')) throw tagTaken();
      throw err;
    }
    await auditTag(c, 'tag.edit', tag.id);
    return ok(c, { ok: true });
  });

  async function findFamily(id: string) {
    if (!isId(id)) throw notFound('Family not found');
    const [family] = await db.select({ id: families.id }).from(families).where(eq(families.id, id));
    if (!family) throw notFound('Family not found');
  }

  app.post('/families/:id/tags', async (c) => {
    const familyId = c.req.param('id');
    const { tagId } = await body(c, z.object({ tagId: z.string() }).strict());
    const tag = await findTag(tagId);
    await findFamily(familyId);
    if (tag.retiredAt) throw new ApiError(409, 'tag_retired', 'That tag has been retired');
    await db
      .insert(familyTagLinks)
      .values({ familyId, tagId, addedBy: c.var.operator.email, addedAt: now() })
      .onConflictDoNothing();
    await audit(
      db,
      c.var.operator,
      { action: 'family.tag_add', targetType: 'family', targetId: familyId },
      now(),
    );
    return ok(c, { ok: true });
  });

  app.post('/families/:id/tags/:tagId/remove', async (c) => {
    const familyId = c.req.param('id');
    const tagId = c.req.param('tagId');
    if (!isId(familyId) || !isId(tagId)) throw notFound('Not found');
    await db
      .delete(familyTagLinks)
      .where(and(eq(familyTagLinks.familyId, familyId), eq(familyTagLinks.tagId, tagId)));
    await audit(
      db,
      c.var.operator,
      { action: 'family.tag_remove', targetType: 'family', targetId: familyId },
      now(),
    );
    return ok(c, { ok: true });
  });

  // The only list view of families: those with one tag (id, sign-in emails, plan, tags).
  app.get('/families', async (c) => {
    const tagId = c.req.query('tag') ?? '';
    if (!isId(tagId)) throw new ApiError(400, 'invalid_request', 'List families by a tag id');
    const tag = await findTag(tagId);
    const links = await db
      .select({ familyId: familyTagLinks.familyId })
      .from(familyTagLinks)
      .where(eq(familyTagLinks.tagId, tag.id))
      .orderBy(desc(familyTagLinks.addedAt))
      .limit(500);
    const ids = links.map((l) => l.familyId);
    const [emails, tagsByFamily] = await Promise.all([
      ids.length === 0
        ? []
        : db
            .select({ familyId: parents.familyId, email: authUsers.email })
            .from(parents)
            .innerJoin(authUsers, eq(authUsers.id, parents.authUserId))
            .where(inArray(parents.familyId, ids))
            .orderBy(parents.createdAt),
      liveTagsFor(db, ids),
    ]);
    await auditTag(c, 'families.by_tag', tag.id);
    return ok(c, {
      families: ids.map((id) => ({
        id,
        parents: emails.filter((e) => e.familyId === id).map((e) => ({ email: e.email })),
        plan: null,
        tags: tagsByFamily.get(id) ?? [],
      })),
    });
  });

  return app;
}

/**
 * Parent routes under `/v1/family`: the only tag a family sees is the beta programme ("Beta"
 * badge), which a parent can leave. Nothing else about tags is sent.
 */
export function parentProgrammeRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();
  app.get('/programmes', async (c) => {
    const effects = await effectsForFamily(db, c.var.parent.familyId);
    return c.json({ beta: effects.betaProgramme });
  });
  app.delete('/programmes/beta', async (c) => {
    const familyId = c.var.parent.familyId;
    const betaTags = await db
      .select({ id: familyTags.id })
      .from(familyTags)
      .where(eq(familyTags.betaProgramme, true));
    if (betaTags.length > 0) {
      await db.delete(familyTagLinks).where(
        and(
          eq(familyTagLinks.familyId, familyId),
          inArray(
            familyTagLinks.tagId,
            betaTags.map((t) => t.id),
          ),
        ),
      );
    }
    return c.body(null, 204);
  });
  return app;
}
