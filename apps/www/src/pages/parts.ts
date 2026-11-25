/** Small HTML pieces shared by the pages. */
import type { SiteConfig } from '../config.ts';

export interface Card {
  title: string;
  text: string;
  /** Not built yet: shown with a "Coming soon" label (docs/BACKLOG.md). */
  soon?: boolean;
}

export const soonLabel = '<span class="soon">Coming soon</span>';

export function cards(items: Card[], headingLevel = 3): string {
  const h = `h${headingLevel}`;
  return `<ul class="cards">${items
    .map(
      (item) =>
        `<li class="card"><${h}>${item.title}${item.soon ? ` ${soonLabel}` : ''}</${h}><p>${item.text}</p></li>`,
    )
    .join('')}</ul>`;
}

/** The testing status line, until WWW_LAUNCHED=true (lead, 2026-11-25). */
export function statusLine(config: SiteConfig): string {
  return config.launched
    ? 'Free to use. Premium is coming soon.'
    : 'RevisionDen is in private testing with a small group of families.';
}

export function callToAction(config: SiteConfig, text: string): string {
  return `<section class="cta">
  <h2>${text}</h2>
  <p>${statusLine(config)}</p>
  <p class="cta__buttons"><a class="button button--primary button--large" href="${config.appUrl}">Start free</a>
  <a class="button button--ghost button--large" href="/how-it-works">How it works</a></p>
</section>`;
}
