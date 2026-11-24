// Version format: MAJOR.MINOR.PATCH as xx.xx.xxx (zero-padded), e.g. 00.01.000.
const PATTERN = /^(\d{2})\.(\d{2})\.(\d{3})$/;
const LIMITS = { major: 99, minor: 99, patch: 999 };

export function parseVersion(text) {
  const match = PATTERN.exec(String(text).trim());
  if (!match) throw new Error(`Invalid version "${text}": expected xx.xx.xxx`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion({ major, minor, patch }) {
  return `${String(major).padStart(2, '0')}.${String(minor).padStart(2, '0')}.${String(patch).padStart(3, '0')}`;
}

export function bumpVersion(text, type) {
  const v = parseVersion(text);
  const next =
    type === 'major'
      ? { major: v.major + 1, minor: 0, patch: 0 }
      : type === 'minor'
        ? { major: v.major, minor: v.minor + 1, patch: 0 }
        : { major: v.major, minor: v.minor, patch: v.patch + 1 };
  for (const part of ['major', 'minor', 'patch']) {
    if (next[part] > LIMITS[part])
      throw new Error(`Version ${part} would overflow (${next[part]})`);
  }
  return formatVersion(next);
}

export function bumpTypeFromMessage(message) {
  if (/\[major\]/i.test(message)) return 'major';
  if (/\[minor\]/i.test(message)) return 'minor';
  return 'patch';
}
