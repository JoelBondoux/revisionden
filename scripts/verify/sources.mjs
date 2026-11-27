// Downloads cited official sources and caches them OUTSIDE the repository (it is public, and exam
// board documents must never be committed). Records the SHA-256 of every source.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Official sources the quote checker may fetch (docs/VERIFICATION.md section 2). */
export const ALLOWED_HOSTS = [
  'qualifications.pearson.com',
  'www.aqa.org.uk',
  'filestore.aqa.org.uk',
  'www.ocr.org.uk',
  'www.eduqas.co.uk',
  'www.wjec.co.uk',
  'www.gov.uk',
  'assets.publishing.service.gov.uk',
  // UK legislation, for unit definitions only (lead's ruling for S4, 2026-11-27).
  'www.legislation.gov.uk',
];

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_CACHE_DIR =
  process.env.REVISIONDEN_SOURCE_CACHE ?? join(homedir(), '.cache', 'revisionden', 'sources');

export function isAllowedSource(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function insideRepo(dir, repoRoot) {
  const rel = relative(resolve(repoRoot), resolve(dir));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * A source store: get(url) => { url, bytes, contentType, sha256, retrievedAt, fromCache }.
 * fetch and now are injected for tests.
 */
export function createSourceStore({
  cacheDir = DEFAULT_CACHE_DIR,
  fetch = globalThis.fetch,
  now = () => new Date(),
  repoRoot = REPO_ROOT,
} = {}) {
  if (insideRepo(cacheDir, repoRoot)) {
    throw new Error(`the source cache must be outside the repository (got ${cacheDir})`);
  }
  const paths = (url) => {
    const key = sha256(url);
    return { data: join(cacheDir, `${key}.bin`), meta: join(cacheDir, `${key}.json`) };
  };

  async function fromCache(url) {
    try {
      const p = paths(url);
      const meta = JSON.parse(await readFile(p.meta, 'utf8'));
      const bytes = new Uint8Array(await readFile(p.data));
      if (sha256(bytes) !== meta.sha256) return null; // damaged copy: download again
      return { ...meta, bytes, fromCache: true };
    } catch {
      return null;
    }
  }

  async function download(url) {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.url && !isAllowedSource(res.url)) {
      throw new Error(`${url} redirected to a host that is not allowed (${res.url})`);
    }
    if (!res.ok) throw new Error(`${url}: download failed: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const meta = {
      url,
      contentType: res.headers.get('content-type') ?? '',
      sha256: sha256(bytes),
      retrievedAt: now().toISOString(),
    };
    const p = paths(url);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(p.data, bytes);
    await writeFile(p.meta, JSON.stringify(meta, null, 2));
    return { ...meta, bytes, fromCache: false };
  }

  return {
    async get(url, { refresh = false } = {}) {
      if (!isAllowedSource(url)) throw new Error(`${url} is not an allowed official source`);
      return (!refresh && (await fromCache(url))) || download(url);
    },
  };
}
