import type { Page } from '../html.ts';
import { escapeHtml } from '../escape.ts';
import { DRAFT_BANNER, type Policy } from '../policies.ts';

export function policiesIndexPage(policies: Policy[], draft: boolean): Page {
  const rows = policies
    .map(
      (policy) =>
        `<li class="card"><h2><a href="/policies/${policy.name}">${escapeHtml(policy.title)}</a></h2><p>${escapeHtml(policy.covers)}.</p><p class="meta">For: ${escapeHtml(policy.audience)}. Version ${escapeHtml(policy.version)}.</p></li>`,
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
  <ul class="cards cards--list">${rows}</ul>
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
  <p class="breadcrumb"><a href="/policies">Policies</a></p>
  <h1>${escapeHtml(policy.title)}</h1>
  ${banner}
  <p class="meta">Version ${escapeHtml(policy.version)}. Effective date: ${escapeHtml(policy.effectiveDate)}.</p>
  <section aria-labelledby="plain"><h2 id="plain">In plain English</h2>${policy.plainEnglishHtml}</section>
  <section aria-labelledby="full"><h2 id="full">Full text</h2>${policy.fullTextHtml}</section>
  <section aria-labelledby="changes"><h2 id="changes">Changes</h2>${policy.changesHtml}</section>
</article>`,
  };
}
