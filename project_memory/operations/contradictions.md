# Contradictions

> Where project memory, docs and code disagree and it was not settled in the same change.
> Add a `- [ ]` line naming both sides, the paths and why it was not settled. Tick when resolved.

## Open

- [ ] `docs/PRIVACY.md` principle 5 says data stays in the UK or EU, but `docs/AI.md` sends
      answers, essays and homework photos to Anthropic, OpenAI and Gemini, which may process them
      in the US. The answers carry no identifying details, but they are still personal data, and a
      photo of homework may show a name. Not settled: needs a product owner decision (EU/UK
      processing where offered, or say so in the privacy notice with the UK transfer safeguard).
      Workstream L must describe whatever is true in `docs/legal/processors.md`.

- [ ] Request schemas for the H routes (push subscriptions, reminder settings, short-answer
      marking) live in `apps/api/src/notifications/routes.ts` and `apps/api/src/ai/routes.ts`, but
      `docs/ARCHITECTURE.md` (Conventions) says every body has a Zod schema in `packages/core`.
      Not settled: `packages/core` is outside workstream H's lane (same TODO as B's device routes).
- [ ] The approved avatar builder has 15 locked items but there are 14 rewards and the old rule was
      "each reward unlocks one item". Settled for now by letting the 100-day streak unlock two items
      (crown and Alien skin) in `packages/core/src/avatar.ts`; `docs/PRODUCT_RULES.md` and
      `product-facts.md` updated. Needs the product owner to confirm or name a 15th reward.
      Superseded by workstream R (five-year rewards catalogue, about 650 unlocks), which gives every
      locked item its own reward.

## Resolved

- [x] **Item type names.** Settled by workstream V: the content schema names (`worked_maths`,
      `extended_answer`) are used everywhere (`packages/core` ItemTypeSchema and XP table, API, web);
      F's `contentTypeToItemType` mapping is removed.
- [x] Item JSON in the `items` table: settled by workstream V. The format is the one the content
      sync writes (`ItemBody` and `ItemAnswer` in `apps/api/src/learning/content-sync.ts`, now with
      `body.marks`); H's marking (`apps/api/src/ai/items.ts`) reads `answer.key.accepted` and
      `answer.markScheme`. Round trip tested in `apps/api/src/ai/items-roundtrip.test.ts`.
- [x] Extended-answer blind marking: implemented by workstream V (`blind-marking` check, validator
      and review-queue rules).
- [x] Extended-answer verification: settled by the lead session in `docs/VERIFICATION.md` section 3.
      Extended answers replace the blind answer with blind marking of exemplar answers, and always need
      individual human approval. Implementation is a follow-up for workstream V.
- [x] GCSE Statistics boards: checked on the board websites (2026-11-24). Only AQA (8382) and
      Pearson Edexcel offer GCSE Statistics; OCR and WJEC Eduqas list none. Fixed in
      `packages/core/src/onboarding.ts` with a test.
- [x] Flashcard XP: keep 5 XP for a flashcard answered inside a lesson and 2 XP per deck review, so
      quick deck flipping cannot farm XP. Lead decision; the product owner can change it.
- [x] Spec reference on flashcards: acceptable. The product owner said citations need not be shown,
      not that they must be hidden; showing the specification point (`source_ref`) is fine. The full
      citation record stays out of the app.
- [x] **"Again" time on flashcards.** The flashcards mockup labels Again "< 1 min"; the scheduler
      (`packages/core/src/spaced-repetition.ts`, PRODUCT_RULES "within 10 minutes") brings a missed
      card back in 10 minutes. The brief says each button shows the time the scheduler computes, so
      the button shows "10 min". Settled by workstream F.
- [x] **Content item ids vs database ids.** Content items have slug ids; `items.id` and core's
      `ItemSchema.id` are uuids. Settled by workstream F with an additive `items.content_id` column.
