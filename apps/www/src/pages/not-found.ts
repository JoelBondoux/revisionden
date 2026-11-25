import type { Page } from '../html.ts';
import { pip } from '../pip.ts';

export function notFoundPage(): Page {
  return {
    path: '/404',
    file: '404.html',
    title: 'Page not found',
    description: 'This page of the RevisionDen website could not be found.',
    unlisted: true,
    body: `<section class="narrow centred">
  ${pip(120)}
  <h1>Page not found</h1>
  <p>That page isn't here. It may have moved.</p>
  <p><a class="button button--primary" href="/">Go to the home page</a></p>
</section>`,
  };
}
