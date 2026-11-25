import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * A small, safe Markdown renderer for the policy files. It builds React elements only (never
 * raw HTML), so anything that looks like HTML in the text is shown as text.
 * Supports headings, paragraphs, bullet and numbered lists, block quotes, rules, tables, bold,
 * italics, inline code and links.
 */

/** Where a Markdown link may go, or null when it is not allowed (shown as plain text). */
export function policyHref(href: string): string | null {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith('#')) return href;
  if (href.startsWith('/legal/')) return href;
  const policy = href.match(/^(?:\.\/)?([a-z0-9-]+)\.md(#[\w-]+)?$/);
  if (policy) return `/legal/${policy[1]}${policy[2] ?? ''}`;
  return null;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = policyHref(link[2]!);
      const label = inline(link[1]!);
      if (!href) return <Fragment key={i}>{label}</Fragment>;
      if (href.startsWith('/')) {
        return (
          <Link key={i} to={href}>
            {label}
          </Link>
        );
      }
      return (
        <a key={i} href={href} rel="noreferrer">
          {label}
        </a>
      );
    }
    if (
      part.length > 2 &&
      ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))
    ) {
      return <em key={i}>{inline(part.slice(1, -1))}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const isRuleRow = (row: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(row);

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** Removes HTML comments (they carry hints such as icon names, never text to show). */
export function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->\s?/g, '');
}

export function Markdown({ text, headingOffset = 0 }: { text: string; headingOffset?: number }) {
  const lines = stripComments(text).split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = () => blocks.length;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1]!.length + headingOffset);
      const Tag = `h${level}` as HeadingTag;
      blocks.push(<Tag key={key()}>{inline(heading[2]!.trim())}</Tag>);
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key()} />);
      i += 1;
      continue;
    }
    if (line.trim().startsWith('|') && lines[i + 1] && isRuleRow(lines[i + 1]!)) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        rows.push(cells(lines[i]!));
        i += 1;
      }
      blocks.push(
        <div className="md-table" key={key()}>
          <table>
            <thead>
              <tr>
                {header.map((h, c) => (
                  <th key={c} scope="col">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2]!);
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i]!.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (item && /\d/.test(item[1]!) === ordered) {
          items.push(item[2]!);
        } else if (items.length && lines[i]!.trim() && /^\s{2,}/.test(lines[i]!)) {
          items[items.length - 1] += ` ${lines[i]!.trim()}`;
        } else {
          break;
        }
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key()}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    if (line.startsWith('>')) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) {
        quoted.push(lines[i]!.replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(<blockquote key={key()}>{inline(quoted.join(' '))}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|>|\s*([-*]|\d+\.)\s+|\s*\|)/.test(lines[i]!)
    ) {
      para.push(lines[i]!.trim());
      i += 1;
    }
    blocks.push(<p key={key()}>{inline(para.join(' '))}</p>);
  }

  return <>{blocks}</>;
}
