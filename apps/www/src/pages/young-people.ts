import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import { pip } from '../pip.ts';
import { cards } from './parts.ts';

export function youngPeoplePage(config: SiteConfig): Page {
  return {
    path: '/young-people',
    file: 'young-people.html',
    nav: 'For young people',
    title: 'For young people',
    description:
      'RevisionDen for students in Years 9 to 13: a topic map, combos, XP, streaks and rewards, a nickname instead of your name, and no adverts.',
    body: `<section class="hero">
  <div class="hero__text">
    <h1>For young people</h1>
    <p class="lead">Revision that feels more like a game, and goes at your pace. Pip the fox is with you all the way.</p>
  </div>
  <div class="hero__art">${pip(180, 'cheer')}</div>
</section>

<section aria-labelledby="what">
  <h2 id="what">What it's like</h2>
  ${cards([
    {
      title: 'Your topic map',
      text: 'Every topic is a hexagon. Watch them fill up and turn gold as you master them.',
    },
    {
      title: 'Combos and XP',
      text: 'Get answers right in a row for a combo. Earn XP, keep your streak going and level up.',
    },
    {
      title: 'Rewards to discover',
      text: 'Avatar items, titles and hidden reward tracks that stay secret until you earn them.',
    },
    {
      title: 'Flashcards that remember for you',
      text: 'Anything you get wrong becomes a flashcard, and it comes back just before you forget it.',
    },
  ])}
</section>

<section class="narrow" aria-labelledby="you">
  <h2 id="you">You stay in control</h2>
  <ul class="ticks">
    <li>You use a nickname, not your real name. No photos, no email address and no password: your device unlocks with a passkey.</li>
    <li>Rewards can never be bought. No adverts, ever.</li>
    <li>There is no chat.</li>
    <li>Your parent sees how your revision is going, such as time spent, topics and rewards. The app shows you what they can see.</li>
    <li>A wrong answer shows you the right one, never a "fail" message.</li>
  </ul>
</section>

<section class="narrow" aria-labelledby="privacy">
  <h2 id="privacy">Your privacy, explained simply</h2>
  <p>We wrote a privacy notice just for you. It explains what we keep, why, and what you can do about it, in plain words.</p>
  <p><a class="button button--primary" href="/policies/privacy-for-young-people">Read the privacy notice for young people</a></p>
  <p>There's also a <a href="${config.appUrl}/legal/privacy-for-young-people">friendlier version with pictures in the app</a>.</p>
</section>

<section class="narrow" aria-labelledby="help">
  <h2 id="help">Need to talk to someone?</h2>
  <p>The app has a private Get help page with UK support services you can call or text. Nothing about it is recorded or shown to your parents. If you are in danger right now, call 999.</p>
</section>`,
  };
}
