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

## Resolved
