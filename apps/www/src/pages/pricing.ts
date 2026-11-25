import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import type { Pricing } from '../pricing.ts';

// Prices come from docs/PRICING.md (decision 0004); payments are not built yet (workstream $).
const FREE = [
  'All verified lessons and questions, as each subject is added',
  'Worked solutions and explanations',
  'Flashcards, the daily 5-a-day, recall checks and Learn it first links',
  'The topic map, streaks, all rewards, titles and the avatar',
  'Game feel and sounds',
  'Basic weekly progress for parents, the daily limit, two parents and reward notifications',
  'Always free: Get help, read aloud, reading comfort, privacy controls, data download and deletion',
];
const PREMIUM = [
  'AI marking of written and long answers',
  'Timed exam practice with marks, likely grade and pacing advice',
  'Predicted grades per subject',
  'Smart study plan around exams and mocks',
  'The full parent dashboard: history, trends, weak-spot insights and PDF',
  'Reading school reports for targets and effort scores',
  'Priority support',
];

const list = (items: string[]) =>
  `<ul class="ticks">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;

export function pricingPage(config: SiteConfig, pricing: Pricing): Page {
  const now = config.launched
    ? '<p class="lead">The app is free to use. An optional Premium plan, per child, is coming soon.</p>'
    : '<p class="lead">RevisionDen is in private testing, and free for the families testing it. When it opens, the app stays free to use, with an optional Premium plan per child.</p>';
  const rows = pricing.perChild
    .map(
      (row) =>
        `<tr><th scope="row">${row.child}</th><td>${row.price}</td><td>${row.familyTotal}</td></tr>`,
    )
    .join('');
  return {
    path: '/pricing',
    file: 'pricing.html',
    nav: 'Pricing',
    title: 'Pricing',
    description:
      'RevisionDen pricing: learning, safety and accessibility stay free. Premium per child, with sibling discounts, is coming soon.',
    body: `<section class="narrow">
  <h1>Pricing</h1>
  ${now}
  <p>Our rule: <strong>learning, safety and accessibility stay free.</strong> Premium covers the parts that cost money to run, mainly AI, and the deeper exam tools.</p>
</section>

<section class="plans" aria-label="Plans">
  <div class="plan">
    <h2>Free</h2>
    <p class="plan__price">£0</p>
    ${list(FREE)}
  </div>
  <div class="plan plan--premium">
    <h2>Premium, coming soon</h2>
    <p class="plan__price">From ${pricing.perChild[0]!.price} a month</p>
    <p>Planned prices per child, a month, including VAT. Nothing is charged yet.</p>
    <div class="table-wrap"><table>
      <caption>Premium price for each child in the family</caption>
      <thead><tr><th scope="col">Child</th><th scope="col">Price</th><th scope="col">Family total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <ul class="ticks">
      <li>Annual plan: about ${pricing.annualFirstChild} a year for the first child, with the same sibling discounts</li>
      <li>${pricing.trialDays}-day free trial, no payment card needed</li>
      <li>Cancel as easily as you subscribe, and keep everything earned</li>
    </ul>
    ${list(PREMIUM)}
  </div>
</section>

<section class="narrow" aria-labelledby="fsm">
  <h2 id="fsm">Free Premium for families with free school meals</h2>
  <p>If your child gets free school meals, or you get Universal Credit or another qualifying benefit, Premium will be free for every child in your family. You tell us which applies; we keep only that choice and the date, never a reference number or document.</p>
</section>

<section class="narrow" aria-labelledby="fair">
  <h2 id="fair">Fair to young people</h2>
  <ul class="ticks">
    <li>Only parents see prices and offers. Students never see adverts for Premium or prompts to ask you to pay.</li>
    <li>Rewards, XP, items and titles can never be bought.</li>
    <li>No adverts, ever.</li>
  </ul>
</section>`,
  };
}
