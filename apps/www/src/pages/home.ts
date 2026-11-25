import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import { pip } from '../pip.ts';
import { callToAction, cards, statusLine } from './parts.ts';

// Every claim here is built on dev today (docs/BACKLOG.md, product facts) or marked "coming soon".
export function homePage(config: SiteConfig): Page {
  return {
    path: '/',
    file: 'index.html',
    title: 'RevisionDen: a family revision tutor for GCSE and A-Level',
    description:
      'RevisionDen is a revision tutor for GCSE and A-Level students that puts practice where it is needed, in a game-like style, with a calm view for parents.',
    body: `<section class="hero">
  <div class="hero__text">
    <h1>Revision that finds the gaps, and makes practice feel like a game</h1>
    <p class="lead">RevisionDen is a revision tutor for GCSE and A-Level students in Years 9 to 13. It puts practice where it's needed most, keeps teenagers coming back with a game-like style, and gives parents a calm view of how it's going.</p>
    <p class="status">${statusLine(config)}</p>
    <p class="hero__buttons"><a class="button button--primary button--large" href="${config.appUrl}">Start free</a>
    <a class="button button--ghost button--large" href="/how-it-works">See how it works</a></p>
  </div>
  <div class="hero__art">${pip(220, 'cheer')}</div>
</section>

<section aria-labelledby="parents">
  <h2 id="parents">For parents</h2>
  <p class="lead">Set it up once, then let it do the planning of what to practise next.</p>
  ${cards([
    {
      title: 'Practice aimed at weak spots',
      text: 'A short starting test in each subject sets the starting point. After that, topics below 60% come first, mixed with review so nothing is forgotten.',
    },
    {
      title: 'See how it’s going',
      text: 'Your parent home shows study time, subjects, weak spots and rewards, for each child. You can also save it as a PDF.',
    },
    {
      title: 'Healthy habits built in',
      text: 'Set a daily study limit for school days and other days, and reminder times with quiet hours. Rewards can come from you, too.',
    },
    {
      title: 'Private by design',
      text: 'Students use a nickname, never their real name. No photos of them, no passwords to remember, no adverts, and nothing about your family is sold.',
    },
  ])}
</section>

<section aria-labelledby="checked">
  <h2 id="checked">Questions you can trust</h2>
  <p>Every question cites an official source, such as the exam board's specification or mark scheme, and passes our checks before any student sees it. Questions are added subject by subject as they pass. GCSE Maths (Higher) is first and is being checked now.</p>
  <p><a class="button button--quiet" href="/how-it-works#checked-questions">How questions are checked</a></p>
</section>

<section class="teen" aria-labelledby="young-people">
  <div class="teen__art">${pip(140, 'happy')}</div>
  <div>
    <h2 id="young-people">For young people</h2>
    <p class="lead">Your revision, your way. Short lessons on a topic map, instant feedback, combos for answers in a row, XP, streaks and rewards for your avatar. Pip the fox cheers you on.</p>
    <p>You pick a nickname and build your avatar. Rewards are earned, never bought, and there are no adverts.</p>
    <p><a class="button button--ghost" href="/young-people">More for young people</a></p>
  </div>
</section>

${callToAction(config, 'Ready to try it?')}`,
  };
}
