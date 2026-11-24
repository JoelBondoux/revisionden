# Contradictions

> Where project memory, docs and code disagree and it was not settled in the same change.
> Add a `- [ ]` line naming both sides, the paths and why it was not settled. Tick when resolved.

## Open

- [ ] Request schemas for the H routes (push subscriptions, reminder settings, short-answer
      marking) live in `apps/api/src/notifications/routes.ts` and `apps/api/src/ai/routes.ts`, but
      `docs/ARCHITECTURE.md` (Conventions) says every body has a Zod schema in `packages/core`.
      Not settled: `packages/core` is outside workstream H's lane (same TODO as B's device routes).
- [ ] Item JSON in the `items` table has no fixed format yet. H's marking reads
      `body.prompt`, `body.marks`, `body.mark_scheme` (or `body.mark_points`) and
      `answer.accepted` (`apps/api/src/ai/items.ts`), matching `content/schemas/item.schema.json`;
      the content loader (F or D) must store items in that shape. Not settled: no loader exists yet.

## Resolved
