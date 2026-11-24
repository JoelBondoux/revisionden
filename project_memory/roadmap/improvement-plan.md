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

- [x] H reminders and AI gateway (#11) merged.
- [x] V verification pipeline and audit (#12) merged.
- [ ] V2: blind marking for extended answers; unify item type names and item JSON format.
- [ ] R: five-year rewards progression (in progress); parent-set rewards (R5) first.
- [ ] K: statistics dashboards for student and parent (spec and mockups 19–20 done; build next).
- [ ] Topic map API endpoints (map, cards due) still to build.

## Blocked

- [ ] G deploys: needs a scoped Cloudflare API token (account + revisionden.com zone) and a Neon
      key scoped to a `revisionden` project.
