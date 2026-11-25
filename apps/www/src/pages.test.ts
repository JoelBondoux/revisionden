import { readSiteConfig } from './config.ts';
import { renderSite, type SiteFiles } from './site.ts';
import { testInputs } from './test-inputs.ts';

const production = readSiteConfig({
  WWW_ENVIRONMENT: 'production',
  VITE_OPERATOR_NAME: 'Example Trading',
  VITE_CONTACT_EMAIL: 'privacy@example.test',
});
const files = renderSite(production, testInputs);
const launchedFiles = renderSite({ ...production, launched: true }, testInputs);

const page = (path: string, from: SiteFiles = files) => {
  const file = from.get(path);
  if (typeof file !== 'string') throw new Error(`${path} is missing`);
  return file;
};
/** Visible text of the page, roughly: tags removed, whitespace squashed. */
const words = (path: string, from: SiteFiles = files) =>
  page(path, from)
    .replace(/<head>[\s\S]*<\/head>/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
const htmlPages = [...files.keys()].filter((path) => path.endsWith('.html'));

describe('site pages', () => {
  it.each([
    ['index.html', 'Revision'],
    ['how-it-works.html', 'How RevisionDen works'],
    ['pricing.html', 'Pricing'],
    ['young-people.html', 'For young people'],
    ['help.html', 'Help and contact'],
    ['policies.html', 'Policies'],
    ['about.html', 'About RevisionDen'],
  ])('%s has one main heading, "%s…"', (path, heading) => {
    const h1s = page(path).match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toContain(heading);
  });

  it('links the main pages from the header', () => {
    const header = page('index.html').match(/<nav class="site-nav"[\s\S]*?<\/nav>/)![0];
    for (const path of ['/how-it-works', '/pricing', '/young-people', '/help'])
      expect(header).toContain(`href="${path}"`);
  });

  it('links the policies, about and young people’s privacy notice from every footer', () => {
    for (const path of htmlPages) {
      const footer = page(path).match(/<footer[\s\S]*<\/footer>/)![0];
      for (const link of ['/policies', '/about', '/help', '/policies/privacy-for-young-people']) {
        expect(footer, path).toContain(`href="${link}"`);
      }
    }
  });
});

describe('home page', () => {
  it('speaks to parents first, then has a section for young people', () => {
    const html = page('index.html');
    expect(html.indexOf('id="parents">For parents')).toBeGreaterThan(0);
    expect(html.indexOf('id="young-people">For young people')).toBeGreaterThan(
      html.indexOf('id="parents"'),
    );
    expect(html).toContain('href="/young-people"');
  });

  it('says questions are checked against official sources before students see them', () => {
    expect(words('index.html')).toContain('official');
  });
});

describe('pricing page', () => {
  const text = words('pricing.html');

  it('shows the planned Premium prices from docs/PRICING.md, marked coming soon', () => {
    expect(text).toContain('Premium, coming soon');
    for (const price of ['£9.99', '£4.99', '£2.99', '£79.99']) expect(text).toContain(price);
    expect(text).toMatch(/4th and more Free/);
    expect(text).toContain('14-day free trial');
  });

  it('says nothing is charged yet', () => {
    expect(text).toContain('Nothing is charged yet');
  });

  it('says the app is free during private testing before launch, and free to use after', () => {
    expect(text).toContain('private testing');
    expect(words('pricing.html', launchedFiles)).toContain('The app is free to use');
    expect(words('pricing.html', launchedFiles)).not.toContain('private testing');
  });

  it('offers free Premium to families with free school meals', () => {
    expect(text).toContain('free school meals');
  });
});

describe('young people page', () => {
  it('links to the young people’s privacy notice here and its friendly version in the app', () => {
    const html = page('young-people.html');
    expect(html).toContain('href="/policies/privacy-for-young-people"');
    expect(html).toContain('href="https://app.revisionden.com/legal/privacy-for-young-people"');
  });

  it('says rewards can never be bought and there are no adverts', () => {
    const text = words('young-people.html');
    expect(text).toContain('never be bought');
    expect(text).toContain('No adverts');
  });
});

describe('help page', () => {
  it('gives the help and privacy email addresses', () => {
    const html = page('help.html');
    expect(html).toContain('href="mailto:help@revisionden.com"');
    expect(html).toContain('href="mailto:privacy@example.test"');
  });

  it('uses privacy@revisionden.com when the contact email is not set', () => {
    const staging = renderSite(readSiteConfig({ WWW_ENVIRONMENT: 'staging' }), testInputs);
    expect(page('help.html', staging)).toContain('href="mailto:privacy@revisionden.com"');
  });
});

describe('policy pages', () => {
  it('lists every policy from docs/legal on the policies page', () => {
    const html = page('policies.html');
    for (const name of Object.keys(testInputs.legalFiles)) {
      expect(html).toContain(`href="/policies/${name.replace(/\.md$/, '')}"`);
    }
  });

  it('renders each policy from its file in docs/legal, not a copy', () => {
    const file = testInputs.legalFiles['terms-of-use.md']!;
    const firstPoint = file.match(/\*\*The parent is in charge\.\*\*/)![0];
    expect(firstPoint).toBeTruthy();
    expect(page('policies/terms-of-use.html')).toContain(
      '<strong>The parent is in charge.</strong>',
    );
    const changed = {
      ...testInputs,
      legalFiles: {
        ...testInputs.legalFiles,
        'terms-of-use.md': file.replace('The parent is in charge.', 'Changed in the source.'),
      },
    };
    expect(page('policies/terms-of-use.html', renderSite(production, changed))).toContain(
      'Changed in the source.',
    );
  });

  it('shows the draft banner on every policy until there is an effective date', () => {
    for (const name of Object.keys(testInputs.legalFiles)) {
      expect(page(`policies/${name.replace(/\.md$/, '.html')}`)).toContain(
        'Draft: not yet in force, being reviewed before launch.',
      );
    }
    const dated = renderSite(
      {
        ...production,
        policyEnv: { ...production.policyEnv, VITE_POLICY_EFFECTIVE_DATE: '2027-01-04' },
      },
      testInputs,
    );
    expect(page('policies/terms-of-use.html', dated)).not.toContain('Draft: not yet in force');
    expect(page('policies/terms-of-use.html', dated)).toContain('2027-01-04');
  });
});

describe('about page', () => {
  it('names who runs RevisionDen from the build variable', () => {
    expect(words('about.html')).toContain('Example Trading');
  });

  it('says the operator details are to be added when the variable is not set', () => {
    const staging = renderSite(readSiteConfig({ WWW_ENVIRONMENT: 'staging' }), testInputs);
    expect(words('about.html', staging)).toContain('details to be added');
  });
});

describe('verified claims only', () => {
  const banned = [
    /testimonial/i,
    /\breviews\b/i,
    /\b\d(?:\.\d)? ?(?:out of 5|\/5)\b/i,
    /trusted by/i,
    /award/i,
    /\d[\d,]* (?:students|families|users|schools)\b/i,
    /improve (?:your |their )?grades?/i,
    /grade (?:improvement|boost)/i,
    /guarantee/i,
    /endorsed/i,
    /\bstars? rating/i,
  ];

  it.each(htmlPages.filter((path) => !path.startsWith('policies/')))(
    '%s makes no invented claims',
    (path) => {
      const text = words(path);
      for (const pattern of banned) expect(text, `${path}: ${pattern}`).not.toMatch(pattern);
    },
  );

  it('never claims the app is open to the public before launch', () => {
    for (const path of ['index.html', 'pricing.html', 'how-it-works.html']) {
      expect(words(path), path).not.toMatch(/free to use now|open to everyone|sign up today/i);
    }
  });
});
