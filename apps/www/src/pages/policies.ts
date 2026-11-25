import type { Page } from '../html.ts';
import { escapeHtml } from '../escape.ts';
import { DRAFT_BANNER, type Policy } from '../policies.ts';

/** Original line icons for policy tiles (docs/GAME_FEEL.md "Links"). Decorative. */
const DOCUMENT_ICON = `<span class="link-tile__icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/></svg></span>`;
const CHEVRON = `<svg class="link-tile__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg>`;

export function policiesIndexPage(policies: Policy[], draft: boolean): Page {
  const rows = policies
    .map(
      (policy) =>
        `<li><a class="link-tile" href="/policies/${policy.name}">${DOCUMENT_ICON}<span class="link-tile__text"><span class="link-tile__title">${escapeHtml(policy.title)}</span><span class="link-tile__description">${escapeHtml(policy.covers)}. For: ${escapeHtml(policy.audience)}.</span></span>${CHEVRON}</a></li>`,
    )
    .join('');
  return {
    path: '/policies',
    file: 'policies.html',
    title: 'Policies',
    description:
      'RevisionDen’s policies: privacy, young people’s privacy, terms, data retention, AI and marking, accessibility and more.',
    body: `<section class="narrow">
  <h1>Policies</h1>
  ${draft ? `<p class="banner" role="note">${DRAFT_BANNER}</p>` : ''}
  <p class="lead">Each policy starts with a short summary in plain English, then the full text. They are the same policies shown in the app.</p>
  <ul class="tiles">${rows}</ul>
</section>`,
  };
}

export function policyPage(policy: Policy): Page {
  const banner = policy.draft ? `<p class="banner" role="note">${DRAFT_BANNER}</p>` : '';
  return {
    path: `/policies/${policy.name}`,
    file: `policies/${policy.name}.html`,
    title: policy.title,
    description: `${policy.title} for RevisionDen: ${policy.covers.charAt(0).toLowerCase()}${policy.covers.slice(1)}.`,
    body: `<article class="narrow policy">
  <p class="breadcrumb"><a class="button button--quiet" href="/policies">All policies</a></p>
  <h1>${escapeHtml(policy.title)}</h1>
  ${banner}
  <p class="meta">Version ${escapeHtml(policy.version)}. Effective date: ${escapeHtml(policy.effectiveDate)}.</p>
  <section aria-labelledby="plain"><h2 id="plain">In plain English</h2>${policy.plainEnglishHtml}</section>
  <section aria-labelledby="full"><h2 id="full">Full text</h2>${policy.fullTextHtml}</section>
  <section aria-labelledby="changes"><h2 id="changes">Changes</h2>${policy.changesHtml}</section>
</article>`,
  };
}
