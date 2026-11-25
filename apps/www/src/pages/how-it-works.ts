import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import { callToAction, cards } from './parts.ts';

// Steps and features follow product facts and docs/BACKLOG.md; unbuilt ones say "coming soon".
const GCSE = [
  'English Language',
  'English Literature',
  'Maths',
  'Statistics',
  'Combined Science',
  'Biology',
  'Chemistry',
  'Physics',
  'French',
  'Spanish',
  'German',
  'History',
  'Drama',
  'Film Studies',
];
const A_LEVEL = ['Maths', 'Further Maths', 'Computer Science', 'Physics'];

export function howItWorksPage(config: SiteConfig): Page {
  return {
    path: '/how-it-works',
    file: 'how-it-works.html',
    nav: 'How it works',
    title: 'How it works',
    description:
      'How RevisionDen works for families: set up each child, link their device with a QR code, a short starting test, then daily practice aimed at weak spots.',
    body: `<section class="narrow">
  <h1>How RevisionDen works</h1>
  <p class="lead">A parent sets things up in a few minutes. After that, each student practises on their own device, and RevisionDen picks what to do next.</p>
  <ol class="steps">
    <li><h2>Sign in and add your children</h2><p>Sign in with your Google account. For each child, choose a nickname, their year group (Years 9 to 13), their subjects and exam boards. Not sure of a board? Pick "not sure" and we'll remind you later.</p></li>
    <li><h2>Link their device</h2><p>Show a QR code on your screen and your child scans it. They then unlock with a passkey (their fingerprint, face or device PIN), so there's no password to forget and no email address needed.</p></li>
    <li><h2>A short starting test</h2><p>About 5 minutes per subject. It finds the starting point for each topic, so practice starts in the right place.</p></li>
    <li><h2>Practice every day</h2><p>Short lessons with instant feedback, a topic map that shows what's strong and what needs work, and flashcards that come back just before they're forgotten. Wrong answers become flashcards automatically.</p></li>
    <li><h2>Follow along</h2><p>Your parent home shows how each child is doing. You can set a daily study limit, reminder times and your own rewards.</p></li>
  </ol>
</section>

<section aria-labelledby="students">
  <h2 id="students">What students get</h2>
  ${cards([
    {
      title: 'Topic map',
      text: 'One hexagon per topic: gold when mastered, orange when it needs work. A "Next mission" card suggests what to do.',
    },
    {
      title: 'Game feel',
      text: 'Big colourful answer buttons, a burst of colour for right answers, combos, XP, streaks and a celebration at the end of each lesson. Calmer when reduced motion is on.',
    },
    {
      title: 'Daily 5-a-day',
      text: 'A quick mix of 5 questions from topics already practised, about 5 to 8 minutes.',
    },
    {
      title: 'Remember this?',
      text: 'Lessons start with 2 quick questions from earlier topics. No penalty: anything missed becomes a flashcard.',
    },
    {
      title: 'Rewards for five years',
      text: 'Levels, avatar items, hidden reward tracks and year chapters from Year 9 to Year 13. All earned, never bought.',
    },
    {
      title: 'Read aloud and reading comfort',
      text: 'Hear questions read out, and choose a dyslexia-friendly font, larger text, more spacing or a tinted background.',
    },
    {
      title: 'Get help',
      text: 'A private page of UK support services, with a quick exit button. Nothing about it is recorded or shown to parents.',
    },
    {
      title: 'Smart study plan',
      text: 'A weekly plan built around exams and mocks, which you can drag and edit.',
      soon: true,
    },
    {
      title: 'Timed exam practice',
      text: 'Timed papers with marks and pacing advice.',
      soon: true,
    },
  ])}
</section>

<section aria-labelledby="marking">
  <h2 id="marking">Marking</h2>
  ${cards([
    {
      title: 'Instant marking',
      text: 'Multiple choice, numeric and short answers are marked straight away against the accepted answers.',
    },
    {
      title: 'Worked maths',
      text: 'Each line of working checked by a maths engine, not by AI.',
      soon: true,
    },
    {
      title: 'AI marking as a guide',
      text: 'Written answers marked against the official mark scheme with help from AI, always labelled "Marked by AI. This is a guide to help you improve, not your teacher’s mark."',
      soon: true,
    },
  ])}
</section>

<section class="narrow" aria-labelledby="checked-questions">
  <h2 id="checked-questions">How questions are checked</h2>
  <p>Every question, answer and mark scheme cites at least one official source, such as the exam board's specification, and passes a set of checks before any student sees it: quotes are checked against the source, answers are worked out independently and compared, and maths and units are checked exactly. Anything that fails stays out.</p>
  <p>If a student reports a mistake, the question is taken out straight away while it's looked at. Read more in the <a href="/policies/content-accuracy">content accuracy policy</a>.</p>
</section>

<section class="narrow" aria-labelledby="subjects">
  <h2 id="subjects">Subjects</h2>
  <p>When you set up, you can choose from these subjects. Questions are added subject by subject as they pass the checks, starting with GCSE Maths (Higher), which is being checked now. Until a subject's questions are ready, there is nothing to practise in it yet.</p>
  <div class="subjects">
    <div><h3>GCSE</h3><ul>${GCSE.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><h3>A-Level</h3><ul>${A_LEVEL.map((s) => `<li>${s}</li>`).join('')}</ul></div>
  </div>
</section>

<section class="narrow" aria-labelledby="devices">
  <h2 id="devices">Devices</h2>
  <p>RevisionDen runs in the web browser on phones, tablets and computers, and can be installed like an app. On an iPad, add it to your Home Screen.</p>
</section>

${callToAction(config, 'Try it with your family')}`,
  };
}
