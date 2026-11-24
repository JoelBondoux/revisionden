# Contradictions

> Where project memory, docs and code disagree and it was not settled in the same change.
> Add a `- [ ]` line naming both sides, the paths and why it was not settled. Tick when resolved.

## Open

- [ ] The approved avatar builder has 15 locked items but there are 14 rewards and the old rule was
      "each reward unlocks one item". Settled for now by letting the 100-day streak unlock two items
      (crown and Alien skin) in `packages/core/src/avatar.ts`; `docs/PRODUCT_RULES.md` and
      `product-facts.md` updated. Needs the product owner to confirm or name a 15th reward.
- [ ] GCSE Statistics boards: the approved design gives the default four (AQA, Pearson Edexcel, OCR,
      WJEC Eduqas), but it is believed only AQA and Pearson Edexcel offer GCSE Statistics. Followed the
      design in `packages/core/src/onboarding.ts`; not verified against board websites, so not changed.
- [ ] **Flashcard XP.** Product facts and `packages/core/src/xp.ts` say a correct flashcard earns 5 XP;
      the approved flashcards design (workstream F brief) says +2 XP per card reviewed in a deck. F
      uses 5 XP for a flashcard answered inside a lesson and 2 XP (`DECK_REVIEW_XP` in
      `packages/core/src/learning.ts`) for each deck review. Not settled because it is a product
      decision: confirm whether deck reviews should earn 2 or 5.
- [ ] **Spec reference on flashcards.** `docs/VERIFICATION.md` says citations are never shown in the
      app; the approved flashcards design shows "its citation's spec reference" small on the answer
      side. F shows the item's `source_ref` (the specification point, for example "content reference
      A18"), not the citation record. Confirm this is acceptable or drop it
      (`apps/web/src/features/flashcards/FlashcardsPage.tsx`).
- [ ] **Item type names.** `content/schemas/item.schema.json` uses `worked_maths` and
      `extended_answer`; `packages/core/src/schemas.ts` (`ItemTypeSchema`, XP table) uses `working` and
      `long_answer`. F maps them (`contentTypeToItemType`) instead of renaming either, because both
      sit in other workstreams' lanes. Pick one set of names.

## Resolved

- [x] **"Again" time on flashcards.** The flashcards mockup labels Again "< 1 min"; the scheduler
      (`packages/core/src/spaced-repetition.ts`, PRODUCT_RULES "within 10 minutes") brings a missed
      card back in 10 minutes. The brief says each button shows the time the scheduler computes, so
      the button shows "10 min". Settled by workstream F.
- [x] **Content item ids vs database ids.** Content items have slug ids; `items.id` and core's
      `ItemSchema.id` are uuids. Settled by workstream F with an additive `items.content_id` column.
