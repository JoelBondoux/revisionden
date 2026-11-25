import { renderMarkdown } from './markdown.ts';

describe('policy Markdown to HTML', () => {
  it('renders headings one level down, so the page title stays the only h1', () => {
    expect(renderMarkdown('### Who we are')).toBe('<h4 id="who-we-are">Who we are</h4>');
  });

  it('can keep heading levels as they are', () => {
    expect(renderMarkdown('### Who we are', 0)).toBe('<h3 id="who-we-are">Who we are</h3>');
  });

  it('caps headings at h6', () => {
    expect(renderMarkdown('###### Deep')).toBe('<h6 id="deep">Deep</h6>');
  });

  it('joins lines into paragraphs and separates paragraphs at blank lines', () => {
    expect(renderMarkdown('One line\nand the next.\n\nSecond.')).toBe(
      '<p>One line and the next.</p>\n<p>Second.</p>',
    );
  });

  it('renders bullet and numbered lists', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('continues a list item onto an indented next line', () => {
    expect(renderMarkdown('- one\n  more\n- two')).toBe('<ul><li>one more</li><li>two</li></ul>');
  });

  it('renders bold, italic, code and links', () => {
    expect(
      renderMarkdown('**Bold** and *soft* and `code` and [a link](https://example.test/x)'),
    ).toBe(
      '<p><strong>Bold</strong> and <em>soft</em> and <code>code</code> and <a href="https://example.test/x">a link</a></p>',
    );
  });

  it('sends links to other policy files to their page on this site', () => {
    expect(renderMarkdown('[terms](terms-of-use.md) and [part](privacy-notice.md#rights)')).toBe(
      '<p><a href="/policies/terms-of-use">terms</a> and <a href="/policies/privacy-notice#rights">part</a></p>',
    );
  });

  it('turns email addresses in links into mailto links', () => {
    expect(renderMarkdown('[help@revisionden.com](mailto:help@revisionden.com)')).toBe(
      '<p><a href="mailto:help@revisionden.com">help@revisionden.com</a></p>',
    );
  });

  it('escapes HTML in the text', () => {
    expect(renderMarkdown('Ages <13 & "up"')).toBe('<p>Ages &lt;13 &amp; &quot;up&quot;</p>');
  });

  it('drops HTML comments, which hold hints for the app’s friendly view', () => {
    expect(renderMarkdown('- <!-- icon: lock --> Kept safe\n\n<!-- note -->\nText')).toBe(
      '<ul><li>Kept safe</li></ul>\n<p>Text</p>',
    );
  });

  it('renders tables with a header row', () => {
    expect(renderMarkdown('| Data | Kept |\n| --- | --- |\n| Answers | 12 months |')).toBe(
      '<div class="table-wrap"><table><thead><tr><th scope="col">Data</th><th scope="col">Kept</th></tr></thead><tbody><tr><td>Answers</td><td>12 months</td></tr></tbody></table></div>',
    );
  });

  it('renders quotes', () => {
    expect(renderMarkdown('> Marked by AI.')).toBe('<blockquote><p>Marked by AI.</p></blockquote>');
  });

  it('refuses links with a script address', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>x</p>');
  });
});
