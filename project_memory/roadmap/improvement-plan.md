# Improvement plan

> The canonical, detailed backlog is `docs/BACKLOG.md`; stages and milestones are in
> `docs/PLAN.md`; who is building what is in `docs/WORKSTREAMS.md`. This page records only the
> current headline.

## Done

- [x] Wave 1 (Stage 1 foundations), merged 2026-11-24: web (#4), API/DB/auth (#6), core rules
      (#3), content format and maths engine (#5).
- [x] Wave 2 so far, merged 2026-11-24: topic map (#8), learning loop and flashcards (#10),
      onboarding and avatar builder (#9), official quotes for the pilot GCSE Maths content (#7;
      109/109 Pearson quotes spot-checked against the PDF by the lead session).

## Now

- [ ] H reminders and AI gateway (#11) and V verification pipeline (#12): regenerating their
      database migrations on top of dev.
- [ ] Topic map API endpoints (map, cards due) still to build.

## Blocked

- [ ] G deploys: needs a scoped Cloudflare API token (account + revisionden.com zone) and a Neon
      key scoped to a `revisionden` project.
