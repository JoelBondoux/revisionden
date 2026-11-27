### What's new

- Pick a subject now lists the subjects you've practised most recently first, and ends with "Want a different subject? Ask a parent", because a parent chooses the family's subjects.

### Added

- UX-1 follow-up (lead's ruling): `GET /v1/student/map` sends `lastPractisedAt` per subject (the latest attempt in the subject, or null; `MapSubjectSchema`, `buildTopicMap`). The subject picker and sheet order practised subjects most recent first, then subjects with questions not started, then the coming-soon fold (`pickerOrder`). The picker ends "Want a different subject? Ask a parent" (`/ask-a-parent`). Tests: `apps/api/src/map.test.ts`, core `map.test.ts`, `chosenSubject.test.ts`, `e2e/tests/subject-switcher.spec.ts`. The top bar's subject sheet takes in new practice times too, so it re-orders after practice (`reportMap` compares every subject field; Codex on #438).
