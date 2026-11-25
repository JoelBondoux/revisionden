import type { Policy } from './policy';

/**
 * The friendly view of the young people's notice (docs/LEGAL.md, "Friendly view"), built from the
 * same Markdown file as the legal text. Hints live in HTML comments, so the file still reads
 * normally on GitHub:
 * - "### The short version" under "In plain English": list items "<!-- icon: name --> Sentence."
 * - each "###" part of the full text: an optional "<!-- icon: name -->" line, then "**In short:**"
 *   and a bullet list of key points; everything after that list is the "Read more" text.
 */
export interface NoticeCard {
  icon: string;
  text: string;
}

export interface NoticeSection {
  id: string;
  title: string;
  icon: string;
  keyPoints: string[];
  details: string;
}

export interface FriendlyNoticeContent {
  intro: string;
  shortVersion: NoticeCard[];
  sections: NoticeSection[];
}

export const DEFAULT_ICON = 'info';
const ICON = /<!--\s*icon:\s*([a-z-]+)\s*-->/;
const SHORT_VERSION = /^###\s+The short version\s*$/i;
const IN_SHORT = /^\*\*In short:?\*\*:?\s*$/i;

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const trimBlank = (lines: string[]) => lines.join('\n').trim();

function parseShortVersion(
  plainEnglish: string,
): Pick<FriendlyNoticeContent, 'intro' | 'shortVersion'> {
  const lines = plainEnglish.split(/\r?\n/);
  const at = lines.findIndex((l) => SHORT_VERSION.test(l));
  if (at < 0) return { intro: plainEnglish.trim(), shortVersion: [] };
  const shortVersion: NoticeCard[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const item = line.match(/^-\s+(.*)$/);
    if (!item) continue;
    const icon = item[1]!.match(ICON)?.[1] ?? DEFAULT_ICON;
    shortVersion.push({ icon, text: item[1]!.replace(ICON, '').trim() });
  }
  return { intro: trimBlank(lines.slice(0, at)), shortVersion };
}

function parseSection(title: string, body: string[]): NoticeSection {
  let icon = DEFAULT_ICON;
  const rest: string[] = [];
  for (const line of body) {
    const found = line.trim().match(new RegExp(`^${ICON.source}$`));
    if (found && icon === DEFAULT_ICON) icon = found[1]!;
    else rest.push(line);
  }
  const keyPoints: string[] = [];
  const start = rest.findIndex((l) => IN_SHORT.test(l.trim()));
  let details = rest;
  if (start >= 0) {
    let i = start + 1;
    while (i < rest.length && !rest[i]!.trim()) i += 1;
    while (i < rest.length && /^-\s+/.test(rest[i]!)) {
      let point = rest[i]!.replace(/^-\s+/, '');
      i += 1;
      while (i < rest.length && /^\s{2,}\S/.test(rest[i]!)) point += ` ${rest[i++]!.trim()}`;
      keyPoints.push(point.trim());
    }
    details = [...rest.slice(0, start), ...rest.slice(i)];
  }
  return { id: slug(title), title, icon, keyPoints, details: trimBlank(details) };
}

export function parseFriendlyNotice(policy: Policy): FriendlyNoticeContent {
  const sections: NoticeSection[] = [];
  let title: string | null = null;
  let body: string[] = [];
  for (const line of policy.fullText.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      if (title) sections.push(parseSection(title, body));
      title = heading[1]!.trim();
      body = [];
    } else if (title) {
      body.push(line);
    }
  }
  if (title) sections.push(parseSection(title, body));
  return { ...parseShortVersion(policy.plainEnglish), sections };
}
