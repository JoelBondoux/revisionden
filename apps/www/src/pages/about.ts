import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import { escapeHtml } from '../escape.ts';
import { pip } from '../pip.ts';

export function aboutPage(config: SiteConfig): Page {
  // The trading name is never committed (decision 0003): it comes from the build variable.
  const operator = config.policyEnv.VITE_OPERATOR_NAME
    ? escapeHtml(config.policyEnv.VITE_OPERATOR_NAME)
    : '(details to be added)';
  return {
    path: '/about',
    file: 'about.html',
    title: 'About RevisionDen',
    description: 'Who runs RevisionDen, why it exists and the principles it is built on.',
    body: `<section class="narrow">
  ${pip(96)}
  <h1>About RevisionDen</h1>
  <p class="lead">RevisionDen began as a private revision tutor for one family, to find each student's weak spots and keep them motivated. It is now being prepared for other families.</p>
  <h2>Who runs it</h2>
  <p>RevisionDen is run by ${operator}, a sole trader. The full details are in the <a href="/policies/privacy-notice">privacy notice</a>.</p>
  <h2>What we stand by</h2>
  <ul class="ticks">
    <li><strong>Privacy first.</strong> We keep the minimum: no student real names, photos or school names, and no passwords.</li>
    <li><strong>No mistakes on the learning side.</strong> Every question is grounded in an official source and checked before students see it.</li>
    <li><strong>Honest marking.</strong> Maths is checked exactly, and AI marking is always labelled as a guide.</li>
    <li><strong>Fair to young people.</strong> No adverts, no rewards for sale, and no pressure tactics.</li>
    <li><strong>Original design.</strong> Inspired by games, never copying anyone else's look. Pip the fox is our own.</li>
  </ul>
  <h2>Pip</h2>
  <p>Pip is an angular, geometric fox and our own original character, drawn from simple shapes. You'll find Pip cheering students on throughout the app.</p>
</section>`,
  };
}
