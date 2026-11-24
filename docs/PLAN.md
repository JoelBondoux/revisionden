# RevisionDen project plan

> Live document. Update it in the same pull request as any change to scope, stages or rules.
> Version of the app this plan describes: see `/VERSION`.

RevisionDen is a private, family revision tutor for GCSE and A-Level students. It finds each
student's weak spots, plans their revision around their exams, and keeps them motivated with a
game-like style. It replaces a paid revision subscription and runs almost entirely on free plans.

## 1. Goals

| Goal                      | How we know it's met                                          |
| ------------------------- | ------------------------------------------------------------- |
| Students revise most days | Both students use it on 5+ days a week for 4 weeks            |
| Effort goes to weak spots | 60%+ of practice time is on topics below 60% mastery          |
| Grades improve            | Mock and assessment results rise towards target grades        |
| Parents stay informed     | Weekly summary sent; parent can set a focus in under a minute |
| Answers are trustworthy   | Fewer than 1 in 200 questions reported as wrong               |
| Cheap to run              | Under £10 a month all-in for one family                       |

## 2. Users

- **Parent:** one adult account that owns the family. Signs in with Google or Microsoft.
- **Students:** one profile per child (GCSE and A-Level). No outside account. Devices are linked
  by a one-time QR code from the parent portal, then unlocked with a passkey.
- **Friends (Stage 4):** other students invited with a parent-approved code. See nickname,
  avatar and XP only. No chat.

## 3. Stages

Each stage is usable on its own. The next stage starts only after the product owner has tried
the last one. Each stage ends with a `[minor]` release to `main`.

### Stage 1: Core learning (target 00.02.000)

| Feature                  | Acceptance criteria                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Family onboarding        | Parent signs in, adds each child (nickname, avatar, year), subjects, boards and tiers ("not sure" allowed), links a device by QR |
| Avatar builder           | Layered avatar saved as a short code; locked items show their unlock target                                                      |
| Subjects and topic trees | Topic list per subject, board and tier, built from official specifications                                                       |
| Starting test            | About 5 minutes per subject; sets initial mastery per topic                                                                      |
| Learning path            | Lessons laid out as a path; current lesson highlighted; weak spots marked                                                        |
| Lessons and quizzes      | Multiple choice and short answer; instant feedback at feedback level 1                                                           |
| Flashcards               | Spaced repetition; wrong cards return sooner                                                                                     |
| XP, daily goal, streak   | XP per correct answer; daily goal; streak counts days with goal met                                                              |
| Exam technique basics    | Command words taught and quizzed                                                                                                 |
| Reminders                | Web push for streak and planned sessions; quiet hours                                                                            |
| AI cost cap              | Monthly cap per child, enforced in the AI gateway                                                                                |

### Stage 2: Smart focus and planning (target 00.03.000)

| Feature                   | Acceptance criteria                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mastery and weak spots    | Mastery % per topic from all answers; weakest topics surfaced                                                           |
| Predicted grade           | From mastery, mock and assessment results, and school progress indicator                                                |
| Exams, mocks, assessments | Entered with dates and results by parent or student                                                                     |
| Study plan calendar       | Auto-built weekly plan weighted to weak topics and upcoming exams; editable by parent and student; rebalances on change |
| School report upload      | Photo or PDF read; values checked by the user; file deleted after reading                                               |
| School report setup       | Effort score name, scale, direction and grade columns, per school                                                       |
| Parent portal             | Weekly summary; suggested focus with light, medium or strong nudge                                                      |
| Feedback levels           | Bigger chunks as the student improves, tied to grade boundaries                                                         |
| Learn and Test modes      | Interactive items reveal answers live in Learn, only after submit in Test                                               |
| Wellbeing                 | Daily study cap, breaks, burnout signals                                                                                |

### Stage 3: Exam practice (target 00.04.000)

| Feature                         | Acceptance criteria                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Past papers                     | Linked from exam board sites or uploaded; sat in the app with a timer                                                              |
| Show your working (maths)       | Write, type steps or photo; each line checked by the maths engine; method marks shown                                              |
| Long written answers and essays | Marked by skill against the mark scheme; labelled as marked by AI                                                                  |
| Mark my homework                | Photo of homework; student confirms the transcription; feedback by skill; never rewrites the work; teacher mark can be added later |
| Exam technique in practice      | Timed papers; mark scheme language                                                                                                 |
| Access arrangements             | Extra time, read-aloud, dyslexia-friendly font                                                                                     |
| A-Level extras                  | Coursework (NEA) deadlines; UCAS predicted grades                                                                                  |

### Stage 4: Motivation and friends (target 00.05.000)

| Feature                 | Acceptance criteria                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Badges and rewards      | 20+ rewards with varied targets; unlock avatar items                                    |
| Friends league          | Weekly XP league; head-to-head challenges; parent-approved invites                      |
| Skip days and gift days | Skip days earned by weekly goal; gift days come with rewards and can only be given away |
| Subject mascot kits     | Pip the fox in a different kit per subject                                              |
| Interactive lessons     | Brilliant-style simulations, starting with the weakest topics                           |

### Stage 5: Public release, optional (target 01.00.000)

Any school's report format; other UK nations' qualifications; ICO Children's Code review;
trademark search; private repository; Apple sign-in.

## 4. Product rules

The exact rules (feedback levels, streaks, gift days, parent focus weights, effort scores) live
in [`PRODUCT_RULES.md`](PRODUCT_RULES.md). They are implemented in `packages/core` with tests.

## 5. Architecture

Summary below; detail in [`ARCHITECTURE.md`](ARCHITECTURE.md).

| Part                       | Service                                                 |
| -------------------------- | ------------------------------------------------------- |
| Web app (PWA)              | React + Vite on Cloudflare                              |
| API and sign-in            | Hono on Cloudflare Workers, Better Auth                 |
| Database                   | Neon Postgres (London), Drizzle ORM                     |
| Uploads                    | Cloudflare R2, deleted after reading                    |
| Maths engine, content jobs | Python + SymPy on Google Cloud Run                      |
| AI                         | Anthropic, OpenAI, Gemini through Cloudflare AI Gateway |

## 6. Quality

Testing protocol: [`TESTING.md`](TESTING.md). In short: red/green/refactor TDD for all
behaviour; coverage gates; end-to-end tests on staging; an evaluation set for AI marking.

## 7. Branches, environments and versions

Detail in [`BRANCHING.md`](BRANCHING.md).

| Branch      | Environment | Gate                                               |
| ----------- | ----------- | -------------------------------------------------- |
| `feature/*` | Local       | Tests pass locally                                 |
| `dev`       | Development | CI green on the pull request                       |
| `staging`   | Staging     | CI green + end-to-end tests + product owner review |
| `main`      | Production  | Staging verified; version bumps automatically      |

## 8. Workstreams

Parallel build sessions and their status: [`WORKSTREAMS.md`](WORKSTREAMS.md).

## 9. Costs

| Item                                      | Approximate cost                             |
| ----------------------------------------- | -------------------------------------------- |
| Hosting, database, uploads, jobs          | £0 (free plans)                              |
| Live AI (hints, marking, reading uploads) | £2 to £5 a month for two students, capped    |
| Question banks                            | £0, written in subscription working sessions |
| Domains                                   | About £20 a year                             |

## 10. Risks

| Risk                         | Mitigation                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------- |
| AI gives a wrong answer      | Content from official sources; two-model check; maths by engine; report button   |
| Costs creep up               | Per-child cap in AI gateway; bulk content generation; caching                    |
| Students lose interest       | Streaks, rewards, friends, parent nudges; short sessions                         |
| Personal data exposure       | Data minimisation; no photos kept; no real names; see `PRIVACY.md`               |
| Exam board changes           | Specifications versioned; question banks rebuilt per specification               |
| Public repository leaks data | No personal data ever committed; PR checklist; secrets only in CI and Cloudflare |

## 11. Open questions

- Exam access arrangements for either student.
- AI provider API account and monthly cap.
- Main device for each student.
