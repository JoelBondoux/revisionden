# Policies and legal text

> Live document. Index of the policies shown in the app, and the rules for writing and changing
> them. The policies are **drafts** until a qualified UK solicitor has reviewed them; they must be
> reviewed before the app is offered to anyone outside the family.

## Status

All eleven policies are written as version 1.0 drafts (workstream L, 2026-11-24). Pages:
`/legal` (index) and `/legal/<name>`, built from these files by `apps/web/src/features/legal`.
Open points for the product owner and a solicitor are in the L pull request and in
`project_memory/operations/contradictions.md`.

## Layout of every policy

Each policy is one Markdown file in `docs/legal/`, shown in the app at `/legal/<name>`:

1. Title, version (`1.0`, `1.1` …) and effective date.
2. **In plain English**: a short summary a parent, or a student of 13, can read in two minutes.
   Short sentences, no legal words, bullet points.
3. **Full text**: the complete legal wording. Where the two differ, the full text applies, and the
   summary says so.
4. **Changes**: a short history in plain English.

The same file is the source for the repository and the app (imported at build), so they can
never drift apart. The public site (`apps/www`, decision 0005) renders the same files at
`revisionden.com/policies/<name>` and reads the order and "Who it is for" from the table below;
its build fails if a file in `docs/legal` is missing from that table.

## The policies

| File                          | Who it is for          | What it covers                                                                  |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `privacy-notice.md`           | Parents and carers     | Full UK GDPR privacy notice: who we are, data, purposes, lawful bases, sharing  |
| `privacy-for-young-people.md` | Students               | The same notice written for 13 to 18 year olds (Children's Code transparency)   |
| `data-retention.md`           | Everyone               | How long each kind of data is kept and how it is deleted                        |
| `processors.md`               | Everyone               | Every service that handles data for us, what it receives, where, and safeguards |
| `cookies-and-storage.md`      | Everyone               | Cookies, local storage, passkeys and push keys (all strictly necessary)         |
| `terms-of-use.md`             | Parents (and students) | The agreement for using the app, parental responsibility, liability             |
| `acceptable-use.md`           | Students and parents   | Community rules: nicknames, friends, gifting, feedback text, misuse             |
| `ai-and-marking.md`           | Everyone               | Where AI is used, what it receives, its limits, "Marked by AI", human checks    |
| `content-accuracy.md`         | Everyone               | How questions are verified and cited, reporting a mistake, what happens next    |
| `accessibility-statement.md`  | Everyone               | Accessibility standard (WCAG 2.2 AA), known gaps, how to ask for help           |
| `childrens-code.md`           | Parents, reviewers     | How each of the ICO Children's Code's 15 standards is met                       |

## Friendly view (young people's notice, L6)

`privacy-for-young-people.md` is also shown as a friendly page, built from the same file (one
source; the Markdown stays the legal text). Hints are HTML comments, so the file still reads
normally on GitHub:

- Under "In plain English", a `### The short version` list of 5 or 6 one-sentence cards, each item
  starting `<!-- icon: name -->`.
- Each `###` part of the full text starts with `<!-- icon: name -->`, then `**In short:**` and 2 to
  4 key points (short sentences, about a 12-year-old's reading level, no legal words). The rest of
  the part is the "Read more" text.
- Icon names are the original SVG icons in `apps/web/src/features/legal/NoticeIcon.tsx`; a test
  fails if the file uses an unknown icon or a part has fewer than 2 or more than 4 key points.

The parent notice and the other policies keep the plain layout for now.

## Rules

- **Truthful to the code.** Every statement about data must match what the code does today
  (`docs/PRIVACY.md`, `docs/AI.md`, `docs/ARCHITECTURE.md`, the code). If the code and a policy
  disagree, it is a bug: fix one in the same PR or record it in
  `project_memory/operations/contradictions.md`. A new kind of data, processor or purpose needs the
  policy updated in the same PR.
- **No personal details in the repository.** The operator's name and contact email are
  placeholders (`{{OPERATOR_NAME}}`, `{{CONTACT_EMAIL}}`), filled at build from
  `VITE_OPERATOR_NAME` and `VITE_CONTACT_EMAIL`. The contact is `privacy@revisionden.com` and no
  postal address is shown (product owner, 2026-11-25); `{{POSTAL_ADDRESS}}` is still supported if
  one is ever added. A build
  without them shows "contact details to be added". `{{EFFECTIVE_DATE}}` comes from
  `VITE_POLICY_EFFECTIVE_DATE` ("date to be added" when unset). `{{SUPPORT_EMAIL}}` (help
  requests) comes from `VITE_SUPPORT_EMAIL`, default `help@revisionden.com` (not personal data, so
  the default is in the repository). `{{CONTACT_EMAIL}}` (`privacy@revisionden.com`) stays the
  contact for privacy questions, data rights and security. Production builds fail without them
  (workstream G).
- **Accurate legal references only.** Name laws and guidance exactly (UK GDPR, Data Protection
  Act 2018, Privacy and Electronic Communications Regulations 2003, ICO Age Appropriate Design
  Code). Never invent a section number, case or quote; if unsure, describe it without a number.
- **Changes.** A change raises the version and adds a plain-English line under "Changes". A
  material change (new data, new purpose, new processor) is shown to parents in the app on their
  next visit and needs them to confirm; students see a plain-English note.
- Parents confirm the terms and privacy notice once during onboarding (version stored, no other
  data). Students see the young people's notice when their device is first linked.
