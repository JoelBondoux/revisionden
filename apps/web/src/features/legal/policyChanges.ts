/**
 * The "We've updated" notice (docs/LEGAL.md) shows only what changed since the version a parent
 * last accepted, taken word for word from the policy's own Changes list ("- 1.10: …").
 */
export interface PolicyChange {
  version: string;
  /** Markdown, exactly as in the policy (wrapped lines joined with a space). */
  text: string;
}

/** Compares "major.minor" versions part by part as numbers, so 1.10 is newer than 1.9. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const LINE = /^-\s+(\d+(?:\.\d+)*):\s+(.*)$/;

/** The Changes lines newer than `accepted`, in the policy's order (newest first). */
export function changesSince(changes: string, accepted: string): PolicyChange[] {
  const lines: PolicyChange[] = [];
  let open = false;
  for (const line of changes.split(/\r?\n/)) {
    const item = line.match(LINE);
    if (item) {
      lines.push({ version: item[1]!, text: item[2]!.trim() });
      open = true;
    } else if (open && /^\s{2,}\S/.test(line)) {
      lines[lines.length - 1]!.text += ` ${line.trim()}`;
    } else {
      open = false;
    }
  }
  return lines.filter((l) => compareVersions(l.version, accepted) > 0);
}
