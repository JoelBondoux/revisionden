import { internalLinks, thirdPartyResources } from './checks.ts';

describe('third-party resource check', () => {
  it('finds scripts, images, stylesheets and fonts loaded from another origin', () => {
    const html = `<script src="https://cdn.example.com/a.js"></script>
      <img src="//images.example.com/b.png"><link rel="stylesheet" href="https://fonts.googleapis.com/css">
      <style>@import url("https://x.example.com/c.css"); .a { background: url(https://y.example.com/d.png) }</style>`;
    expect(thirdPartyResources(html)).toEqual([
      'https://cdn.example.com/a.js',
      '//images.example.com/b.png',
      'https://fonts.googleapis.com/css',
      'https://x.example.com/c.css',
      'https://y.example.com/d.png',
    ]);
  });

  it('ignores ordinary links, which load nothing until clicked', () => {
    expect(thirdPartyResources('<a href="https://app.revisionden.com">Sign in</a>')).toEqual([]);
  });

  it('ignores this site’s own files', () => {
    expect(
      thirdPartyResources('<link rel="stylesheet" href="/styles.css"><img src="/og.png">'),
    ).toEqual([]);
  });

  it('treats an absolute address on the site’s own origin as its own', () => {
    expect(
      thirdPartyResources(
        '<link rel="icon" href="https://revisionden.com/icon.svg">',
        'https://revisionden.com',
      ),
    ).toEqual([]);
  });
});

describe('internal link list', () => {
  it('lists links and resources on this site, without fragments or queries', () => {
    const html = `<a href="/pricing#free">x</a><a href="/">y</a><link href="/styles.css">
      <a href="https://app.revisionden.com">z</a><a href="mailto:help@revisionden.com">m</a><a href="#main">s</a>`;
    expect(internalLinks(html)).toEqual(['/pricing', '/', '/styles.css']);
  });
});
