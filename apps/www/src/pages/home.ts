import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';
import { pip } from '../pip.ts';

export function homePage(config: SiteConfig): Page {
  return {
    path: '/',
    file: 'index.html',
    title: 'RevisionDen: a family revision tutor for GCSE and A-Level',
    description:
      'RevisionDen is a revision tutor for GCSE and A-Level students, built for families. Free to use now.',
    body: `<section class="hero">
  <div class="hero__text">
    <h1>Revision that fits your family</h1>
    <p class="lead">A revision tutor for GCSE and A-Level students, with a calm view for parents. Free to use now.</p>
    <p><a class="button button--primary button--large" href="${config.appUrl}">Start free</a></p>
  </div>
  <div class="hero__art">${pip(200, 'cheer')}</div>
</section>`,
  };
}
