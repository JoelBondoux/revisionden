import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Markdown, policyHref } from './Markdown';

const show = (text: string, headingOffset?: number) =>
  render(
    <MemoryRouter>
      <Markdown text={text} headingOffset={headingOffset} />
    </MemoryRouter>,
  );

describe('Markdown', () => {
  it('shows headings, paragraphs and lists', () => {
    show(
      '### Who we are\n\nWe are small.\nStill one paragraph.\n\n- one\n- two\n\n1. first\n2. second',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Who we are' })).toBeInTheDocument();
    expect(screen.getByText('We are small. Still one paragraph.')).toBeInTheDocument();
    const lists = screen.getAllByRole('list');
    expect(lists[0]!.tagName).toBe('UL');
    expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(2);
    expect(lists[1]!.tagName).toBe('OL');
  });

  it('moves headings down by the offset, never past level 6', () => {
    show('# Top\n\n#### Deep', 2);
    expect(screen.getByRole('heading', { level: 3, name: 'Top' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Deep' })).toBeInTheDocument();
  });

  it('shows bold, italics and code inline', () => {
    const { container } = show('Some **bold**, *soft*, _also soft_ and `code`.');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelectorAll('em')).toHaveLength(2);
    expect(container.querySelector('code')).toHaveTextContent('code');
  });

  it('turns policy file links into app links and keeps web and email links', () => {
    show(
      '[Privacy](privacy-notice.md), [Web](https://ico.org.uk/), [Mail](mailto:help@example.com)',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/legal/privacy-notice',
    );
    expect(screen.getByRole('link', { name: 'Web' })).toHaveAttribute(
      'href',
      'https://ico.org.uk/',
    );
    expect(screen.getByRole('link', { name: 'Mail' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
  });

  it('shows unsafe links as plain text', () => {
    show('[Click](javascript:void0) and [Other](../secret.md)');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Click and Other/)).toBeInTheDocument();
  });

  it('shows tables with a header row', () => {
    show('| Data | Kept |\n| --- | --- |\n| Nickname | Until deleted |\n| Uploads | 24 hours |');
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Data', 'Kept']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('never renders raw HTML', () => {
    const { container } = show('<script>bad()</script> <b>x</b>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container).toHaveTextContent('<script>bad()</script> <b>x</b>');
  });

  it('shows block quotes and horizontal rules', () => {
    const { container } = show('> Quoted words\n\n---\n\nAfter');
    expect(container.querySelector('blockquote')).toHaveTextContent('Quoted words');
    expect(container.querySelector('hr')).not.toBeNull();
  });
});

describe('policyHref', () => {
  it.each([
    ['privacy-notice.md', '/legal/privacy-notice'],
    ['./terms-of-use.md#liability', '/legal/terms-of-use#liability'],
    ['/legal/processors', '/legal/processors'],
    ['https://example.com', 'https://example.com'],
    ['http://example.com', 'http://example.com'],
    ['mailto:a@example.com', 'mailto:a@example.com'],
    ['#section', '#section'],
    ['javascript:alert(1)', null],
    ['../PRIVACY.md', null],
  ])('%s → %s', (input, expected) => {
    expect(policyHref(input)).toBe(expected);
  });
});
