# Contradictions

> Where project memory, docs and code disagree and it was not settled in the same change.
> Add a `- [ ]` line naming both sides, the paths and why it was not settled. Tick when resolved.

## Open

- [ ] **ICO complaint wording awaiting owner check.** `docs/legal/complaints-policy.md` 6.1 has a
      marked placeholder instead of the ICO's complaint page and phone number, and the parent's
      complaint page (`apps/web/src/features/complaints/ComplaintsPage.tsx`) names the ICO without
      contact details. The wording in `docs/legal/privacy-notice.md` ("ico.org.uk/make-a-complaint,
      or by phone on 0303 123 1113") could not be re-checked: ico.org.uk is blocked from the build
      sessions. Not settled: the product owner will check ico.org.uk personally (decision 0006).
- [ ] **Combined Science and the build rule.** `docs/CONTENT_PLAN.md` "Initial subject set" leaves
      out GCSE Combined Science, which `project_memory/domain/product-facts.md` and
      `packages/core/src/onboarding.ts` offer; it also says content is built "only for the board and
      tier combinations actually selected", while the owner now wants the most-used board first
      (`docs/research/board-shares-2026-11.md`). Not settled: a content-plan decision for the
      product owner, not a research change.
- [ ] **Synced passkeys unlock on other devices (owner question).** `docs/PRODUCT_RULES.md` says
      students use their own device, linked by QR code and passkey, and parents see and unlink
      each linked device. But a passkey synced through iCloud Keychain or Google Password Manager
      unlocks on the child's other devices too, as the same `devices` row
      (`apps/api/src/routes/devices.ts` matches `devices.credential_id`). Not settled: the owner
      should choose to allow it, refuse synced passkeys at linking, or allow it and tell the
      parent (options in `project_memory/decisions/0007-student-passkey-unlock.md`).

- [ ] **Hidden tracks with no data yet (R7b).** Fact Checker (`factChecks`: `item_reports` has a
      family id but no student id, workstream V), Planner (`plannedWeeks`: no planned sessions,
      workstream P), Pace Setter (`pacedPapers`: no timed papers, workstream X) and Perfectionist
      (`perfectSetsLevel2`: practice sets are not stored) are in the catalogue but count 0 in
      `apps/api/src/routes/rewards.ts`. Explorer counts 4 of its 7 kinds today (no timed paper,
      homework marking or plan edit records). Not settled because the data belongs to other
      workstreams.

- [ ] **School holidays and the daily limit.** `docs/PRODUCT_RULES.md` (Daily limit) gives other
      days (weekends and holidays) the higher limit, but no school holiday dates are stored, so
      `dayTypeOf` in `packages/core/src/daily-limit.ts` treats holidays as school days (it takes a
      `holidays` list that the API passes empty). Not settled: term and holiday dates need the
      school report or study plan work, or a parent setting.
- [ ] **Secret achievement stats with no data yet.** "Patch Day" (weak spots fixed in a day),
      "On Pace" (timed papers on pace, workstream X) and "Card Shark" (flashcards in a week; deck
      reviews have no timestamped record) are in the catalogue but their stats count as 0 until the
      data exists (`packages/core/src/catalogue/hidden.ts`).

- [ ] **Daily limit changes in the activity log.** `docs/PRODUCT_RULES.md` ("Two parents") says the
      other parent is told when a limit changes, but the daily limit (same page, "Daily limit") has
      no API route yet. B3 logs `PUT /v1/students/:id/daily-limit` as an important change
      (`apps/api/src/family-events.ts`, `LOGGED_CHANGES`); the limits workstream must use that
      route (or update the table) when it builds it.
- [ ] **AQA's AI clause and our content pipeline.** AQA's copyright policy says it "does not
      permit the use of any AQA material in any manner or for any purposes in connection with the
      training" of AI tools and "will not allow the use of any AQA material" in a third-party work
      partly "generated or produced using Artificial Intelligence"
      (https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy,
      checked 2026-11-25). `docs/CONTENT_PLAN.md` writes items in AI working sessions from official
      source excerpts and quotes them in citations. Not settled: needs a legal answer or written
      AQA permission before any AQA subject is built; the pilot (Pearson Edexcel 1MA1) is not
      affected. Detail: `docs/research/competitors-2026-11.md` section 3.3. Pearson reportedly
      reserves "text and data mining and training of artificial intelligence" rights (search extract,
      `pearson.com` blocked, not confirmed); OCR and WJEC Eduqas have no AI clause
      (`docs/research/board-shares-2026-11.md` section 3).
- [ ] **Reward stats with no data yet.** Milestones for past papers, mock and assessment grades,
      exams sat, weak spots fixed, perfect sets, gifting and the friends league
      are in the catalogue, but nothing records those numbers yet, so the rewards route counts them
      as 0 (`apps/api/src/routes/rewards.ts`). They unlock once those features store the numbers.
- [ ] **OAuth tokens kept.** `docs/PRIVACY.md` and the policies say only the parent's sign-in
      email is stored, but Better Auth stores `access_token`, `refresh_token` and `id_token` in
      `auth_accounts` (`packages/db/src/schema.ts`, `apps/api/src/auth.ts`); a Google or Microsoft
      ID token usually carries the account name and picture URL. Not settled: auth is workstream
      B's lane. The privacy notice (4.5) describes it as it is today.
- [ ] **Youngest school year.** Onboarding and the policies take Years 9 to 13 (13+), but the
      `students_year_group_range` check in `packages/db/src/schema.ts` allows 7 to 13. Not
      settled: schema is B's lane; needs a product owner nod to tighten to 9.
- [ ] **Promised deletion tools not built.** `docs/PRIVACY.md` says "export first is offered" and
      "accounts unused for 12 months are deleted automatically"; neither exists in `apps/api`.
      Expired link tokens, student sessions and parent sessions are not cleaned up either. The
      policies (`docs/legal/data-retention.md`) say "still to do". Not settled: outside L's lane.
- [ ] **Own flashcards are not privacy-checked.** Students can write their own flashcards (300
      characters a side, `apps/api/src/routes/flashcards.ts`) and they are stored as free text with
      no personal-data check, unlike AI requests and feedback. Not settled: F's lane; the
      community rules ask students to take care.
- [ ] **Parent reward notification.** `docs/REWARDS.md` says the parent gets a notification when a
      parent-set target is met; not built (reminders are workstream H). The student celebration is
      built.
- [ ] **Live AI providers in the docs.** `docs/ARCHITECTURE.md` (diagram) and `docs/AI.md` (photo
      reading by Gemini or Claude) describe Gemini and OpenAI as live providers, but in the code only
      Anthropic is used live; OpenAI's `second_check` job is not called by any route and Gemini is
      used only offline in `scripts/verify`. Not settled: docs belong to H and the lead; the policies
      describe the code.
- [ ] **R2 bucket location.** `docs/PRIVACY.md` principle 5 says data stays in the UK or EU, but
      `apps/api/wrangler.toml` sets no R2 jurisdiction or location for `UPLOADS`. Not settled:
      deploy config is G's lane; nothing uploads yet.

- [ ] Request schemas for the H routes (push subscriptions, reminder settings, short-answer
      marking) live in `apps/api/src/notifications/routes.ts` and `apps/api/src/ai/routes.ts`, but
      `docs/ARCHITECTURE.md` (Conventions) says every body has a Zod schema in `packages/core`.
      Not settled: `packages/core` is outside workstream H's lane (same TODO as B's device routes).
- [ ] Item JSON in the `items` table has no fixed format yet. H's marking reads
      `body.prompt`, `body.marks`, `body.mark_scheme` (or `body.mark_points`) and
      `answer.accepted` (`apps/api/src/ai/items.ts`), matching `content/schemas/item.schema.json`;
      the content loader (F or D) must store items in that shape. Not settled: no loader exists yet.
- [ ] **Item type names.** `content/schemas/item.schema.json` uses `worked_maths` and
      `extended_answer`; `packages/core/src/schemas.ts` (`ItemTypeSchema`, XP table) uses `working` and
      `long_answer`. F maps them (`contentTypeToItemType`) instead of renaming either, because both
      sit in other workstreams' lanes. Pick one set of names.
- [ ] **Question reports when a family is deleted.** `docs/legal/data-retention.md` says reports
      of a mistake are "kept as part of the content audit trail; linked to the family until the
      family account is deleted", but `item_reports.family_id` is `on delete cascade`
      (`packages/db/src/schema.ts`), so deleting a family (by hand or the 12-month inactive
      clean-up) deletes its reports too. Not settled: keeping them needs a nullable family id and
      a decision from workstream V on the audit trail; B2 left the code as it is.

- [ ] **Topic map and cards due have no API yet.** The web app's map (`/map`) and Cards badge call
      `GET /v1/student/map` and `GET /v1/student/cards/due` (`apps/web/src/api/client.ts`), agreed
      with F2, but `apps/api` has neither, so on staging the map shows "Something went wrong" (with
      a code) and the badge shows 0. A student device therefore has no way into subject lessons
      except a direct link. Not settled: F2's lane; no F2 branch or PR exists yet (2026-11-25).

## Resolved

- [x] **Daily limit changes in the activity log.** `docs/PRODUCT_RULES.md` ("Two parents") says the
      other parent is told when a limit changes, but the daily limit (same page, "Daily limit") has
      no API route yet. B3 logs `PUT /v1/students/:id/daily-limit` as an important change
      (`apps/api/src/family-events.ts`, `LOGGED_CHANGES`); the limits workstream must use that
      route (or update the table) when it builds it.
      Settled (K7): the route is `PUT /v1/students/:id/daily-limit`, so B3's table logs it; an
      accepted suggestion (`POST .../suggestion`) logs `limit_changed` itself.
- [x] Bug Hunter count and XP: settled once workstream L's #52 merged. The rewards route reads
      L's `confirmedBugCount` and adds L's `bugRewardXp` to reward XP for levels
      (`apps/api/src/routes/rewards.ts`); nothing is written to `attempts`.
- [x] **Flashcard deck XP and rewards.** `docs/REWARDS.md` says XP from flashcards counts towards
      levels, but deck reviews (`apps/api/src/routes/flashcards.ts`) only add to `daily_xp`, which
      has no time of day, so the late-night rule cannot be checked. Reward XP is therefore built
      from `attempts` only (`apps/api/src/routes/rewards.ts`) and deck reviews do not count yet.
      Not settled: the fix (a timestamped XP record for deck reviews) is in workstream F's lane.
      Settled by F3 (2026-11-25): each completed session is stored with its time in
      `flashcard_sessions`, and its XP counts for rewards under the same late-night and daily cap
      rules. Flashcards reviewed now counts too.
- [x] **Parent reward notification.** `docs/REWARDS.md` says the parent gets a notification when a
      parent-set target is met; not built (reminders are workstream H). The student celebration is
      built. Settled by H2 (2026-11-25): parent devices get one web push per reward
      (`apps/api/src/notifications/parent-rewards.ts`, migration 0007); not counted in the 2-a-day
      limit, respects the child's nightly quiet hours.
- [x] **OAuth tokens kept.** `docs/PRIVACY.md` and the policies say only the parent's sign-in
      email is stored, but Better Auth stores `access_token`, `refresh_token` and `id_token` in
      `auth_accounts` (`packages/db/src/schema.ts`, `apps/api/src/auth.ts`); a Google or Microsoft
      ID token usually carries the account name and picture URL. Not settled: auth is workstream
      B's lane. The privacy notice (4.5) describes it as it is today.
      B2 (2026-11-25): settled. Better Auth needs only the provider account id to sign a parent in
      again, so the account hook blanks access, refresh and ID tokens (and their expiry times) on
      create and update (`apps/api/src/auth.ts`, tested in `auth.test.ts`). Privacy notice 4.5,
      `docs/legal/processors.md` and `docs/PRIVACY.md` updated.
- [x] **Youngest school year.** Onboarding and the policies take Years 9 to 13 (13+), but the
      `students_year_group_range` check in `packages/db/src/schema.ts` allows 7 to 13. Not
      settled: schema is B's lane; needs a product owner nod to tighten to 9.
      B2 (2026-11-25): settled by the B2 brief (product owner). Database check is now 9 to 13
      (migration 0006), and core's `YearGroupSchema` and the web response schema match, so the API
      answers 400 for Years 7 and 8.
- [x] **Promised deletion tools not built.** `docs/PRIVACY.md` says "export first is offered" and
      "accounts unused for 12 months are deleted automatically"; neither exists in `apps/api`.
      Expired link tokens, student sessions and parent sessions are not cleaned up either. The
      policies (`docs/legal/data-retention.md`) say "still to do". Not settled: outside L's lane.
      B2 (2026-11-25): settled. Export (`GET /v1/export` and a parent-area button), 12-month
      inactive deletion with a return warning, and clean-up of expired link codes, sessions,
      challenges and sign-in checks, all in the 15-minute cron (`apps/api/src/cleanup.ts`).
      `docs/legal/data-retention.md` and the privacy notice updated. The parent account deletion
      button is still to do (not in this contradiction).
- [x] **Own flashcards are not privacy-checked.** Students can write their own flashcards (300
      characters a side, `apps/api/src/routes/flashcards.ts`) and they are stored as free text with
      no personal-data check, unlike AI requests and feedback. Not settled: F's lane; the
      community rules ask students to take care.
      B2 (2026-11-25): settled. Own cards get the feedback check (email, UK mobile, any family
      nickname) before saving (`apps/api/src/routes/flashcards.ts`, cleared with F for this change).
- [x] **"Who's revising?" on a parent's device.** Picking a child opened `/map`, which needs the
      student device cookie. Settled by the product owner (2026-11-25): parent view only. Tapping
      a child opens the parent's stats dashboard for that child (`/parent/stats?student=<id>`),
      with "Rewards you set" and "Link a device" per child and a "Family feedback" link; it never
      opens student screens (`apps/web/src/pages/FamilyPage.tsx`, `docs/PRODUCT_RULES.md`).

- [x] `docs/PRIVACY.md` principle 5 says data stays in the UK or EU, but `docs/AI.md` sends
      answers, essays and homework photos to Anthropic, OpenAI and Gemini, which may process them
      in the US. The answers carry no identifying details, but they are still personal data, and a
      photo of homework may show a name. Not settled: needs a product owner decision (EU/UK
      processing where offered, or say so in the privacy notice with the UK transfer safeguard).
      Workstream L must describe whatever is true in `docs/legal/processors.md`.
      L (2026-11-24): `docs/legal/processors.md` and the privacy notice now say honestly that
      answer text may be processed in the US and that the safeguard is still to confirm. Still open.
      Settled 2026-11-25 by the product owner: US processing of AI marking text is accepted for
      now; stored data stays in the UK or EU. Recorded in decision 0003; PRIVACY.md and the
      privacy notice updated. The per-provider safeguard is still to confirm before any public release.

- [x] **Feedback device details default.** Spec said on by default; the Children's Code prefers the
      most private default. Lead decision (2026-11-24): off by default for students, on for parents.
      Implemented in `apps/web/src/features/feedback/FeedbackPage.tsx` with a test; PRODUCT_RULES,
      product facts, the privacy notice and `docs/legal/childrens-code.md` updated.

- [x] 15 locked avatar items and 14 rewards: settled by workstream R. In the five-year catalogue a
      reward can give several items (the finisher sets give three), so the 100-day streak giving
      the crown and the Alien skin is consistent and keeps rewards already earned intact. Every
      locked avatar item now names the one reward that unlocks it, checked by the catalogue
      validator (`packages/core/src/catalogue/validate.ts`).

- [ ] The approved avatar builder has 15 locked items but there are 14 rewards and the old rule was
      "each reward unlocks one item". Settled for now by letting the 100-day streak unlock two items
      (crown and Alien skin) in `packages/core/src/avatar.ts`; `docs/PRODUCT_RULES.md` and
      `product-facts.md` updated. Needs the product owner to confirm or name a 15th reward.
      Superseded by workstream R (five-year rewards catalogue, about 650 unlocks), which gives every
      locked item its own reward.
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
- [x] Flashcard XP (superseded 2026-11-25: deck XP is now 20 per completed session, see PRODUCT_RULES): keep 5 XP for a flashcard answered inside a lesson and 2 XP per deck review, so
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
