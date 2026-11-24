export interface WhatsNewVersion {
  /** "Unreleased" or a version like "00.04.012". */
  version: string;
  date?: string;
  lines: string[];
}

/**
 * The plain-English changelog: the lines under each version's `### What's new` subsection in
 * CHANGELOG.md, newest first (the file's order). Versions without one are left out.
 */
export function parseWhatsNew(markdown: string): WhatsNewVersion[] {
  const versions: WhatsNewVersion[] = [];
  let current: WhatsNewVersion | null = null;
  let inWhatsNew = false;
  for (const line of markdown.split(/\r?\n/)) {
    const version = line.match(/^## \[([^\]]+)\](?:\s*-\s*(\S+))?/);
    if (version) {
      current = { version: version[1]!, ...(version[2] ? { date: version[2] } : {}), lines: [] };
      versions.push(current);
      inWhatsNew = false;
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      inWhatsNew = /^### What['’]s new\s*$/i.test(line);
      continue;
    }
    if (!inWhatsNew || !current) continue;
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) current.lines.push(bullet[1]!.trim());
    else if (/^\s+\S/.test(line) && current.lines.length) {
      current.lines[current.lines.length - 1] += ` ${line.trim()}`;
    }
  }
  return versions.filter((v) => v.lines.length > 0);
}
