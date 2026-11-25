/**
 * A small Markdown renderer for the policies in docs/legal (the subset they use: headings,
 * paragraphs, lists, tables, quotes, bold, italic, code and links). Text is escaped first, so
 * nothing in a policy can add HTML. Links to other policy files point at /policies/<name>.
 */
import { escapeHtml } from './escape.ts';

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const LINK = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

function href(url: string): string | null {
  const policy = url.match(/^([a-z0-9-]+)\.md(#[a-z0-9-]+)?$/);
  if (policy) return `/policies/${policy[1]}${policy[2] ?? ''}`;
  if (/^(https?:|mailto:|\/|#)/.test(url)) return url;
  return null;
}

function inline(text: string): string {
  const codes: string[] = [];
  let html = escapeHtml(text).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  html = html.replace(LINK, (_, label: string, url: string) => {
    const target = href(url.replace(/&amp;/g, '&'));
    return target ? `<a href="${escapeHtml(target)}">${label}</a>` : label;
  });
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return html.replace(/\uE000(\d+)\uE000/g, (_, i: string) => codes[Number(i)]!);
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

function table(rows: string[]): string {
  const [head, , ...body] = rows;
  const th = cells(head!)
    .map((cell) => `<th scope="col">${inline(cell)}</th>`)
    .join('');
  const trs = body
    .map(
      (row) =>
        `<tr>${cells(row)
          .map((cell) => `<td>${inline(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

const BULLET = /^\s*[-*] (.*)$/;
const NUMBER = /^\s*\d+\. (.*)$/;

/** headingShift: how many levels to move headings down (1 turns ### into h4). */
export function renderMarkdown(markdown: string, headingShift = 1): string {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1]!.length + headingShift, 6);
      const text = inline(heading[2]!.trim());
      out.push(`<h${level} id="${slug(text)}">${text}</h${level}>`);
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(lines[i++]!);
      out.push(table(rows));
      continue;
    }
    if (line.startsWith('>')) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>'))
        quoted.push(lines[i++]!.replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'), headingShift)}</blockquote>`);
      continue;
    }
    const listType = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (listType) {
      const marker = listType === 'ul' ? BULLET : NUMBER;
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim()) {
        const item = lines[i]!.match(marker);
        if (item) items.push(item[1]!.trim());
        else if (/^\s+\S/.test(lines[i]!) && items.length)
          items[items.length - 1] += ` ${lines[i]!.trim()}`;
        else break;
        i++;
      }
      out.push(
        `<${listType}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${listType}>`,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|>|\s*\|)/.test(lines[i]!) &&
      !BULLET.test(lines[i]!) &&
      !NUMBER.test(lines[i]!)
    ) {
      paragraph.push(lines[i++]!.trim());
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}
