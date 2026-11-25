import type { SiteConfig } from '../config.ts';
import type { Page } from '../html.ts';

const DEFAULT_SUPPORT = 'help@revisionden.com';
const DEFAULT_PRIVACY = 'privacy@revisionden.com';

const mail = (address: string) => `<a href="mailto:${address}">${address}</a>`;

export function helpPage(config: SiteConfig): Page {
  const support = config.policyEnv.VITE_SUPPORT_EMAIL ?? DEFAULT_SUPPORT;
  const privacy = config.policyEnv.VITE_CONTACT_EMAIL ?? DEFAULT_PRIVACY;
  return {
    path: '/help',
    file: 'help.html',
    nav: 'Help',
    title: 'Help and contact',
    description:
      'Get help with RevisionDen: email for support, privacy and data requests, and answers to common questions.',
    body: `<section class="narrow">
  <h1>Help and contact</h1>
  <div class="contact">
    <div class="card"><h2>Help and support</h2><p>Questions, problems or ideas: ${mail(support)}</p><p>If the app showed a reference code like RD-7K2M9Q, include it so we can find what went wrong.</p></div>
    <div class="card"><h2>Privacy and your data</h2><p>Privacy questions, data requests and security: ${mail(privacy)}</p><p>Parents can also download or delete their family's data in the app.</p></div>
  </div>
  <p>Spotted a mistake in a question? Use the report button in the app; the question comes out while it's checked. See the <a href="/policies/content-accuracy">content accuracy policy</a>.</p>
</section>

<section class="narrow" aria-labelledby="faq">
  <h2 id="faq">Common questions</h2>
  <dl class="faq">
    <dt>Does my child need an email address?</dt>
    <dd>No. Only the parent signs in. Students use a nickname, and their device is linked with a QR code and unlocked with a passkey.</dd>
    <dt>Which year groups is it for?</dt>
    <dd>Years 9 to 13: GCSE in Years 9 to 11 and A-Level in Years 12 and 13.</dd>
    <dt>What does it cost?</dt>
    <dd>See <a href="/pricing">Pricing</a>. Nothing is charged yet.</dd>
    <dt>Which devices does it work on?</dt>
    <dd>Any up-to-date web browser on a phone, tablet or computer. It can be installed like an app.</dd>
    <dt>Can two parents share it?</dt>
    <dd>Yes. Invite a second parent from your parent home; you both get the same control.</dd>
    <dt>How do I delete our data?</dt>
    <dd>From the app, or by emailing ${mail(privacy)}. A family account unused for 12 months is deleted automatically.</dd>
  </dl>
</section>`,
  };
}
