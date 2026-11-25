/// <reference types="vitest" />
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { listLicences } from './src/features/about/licences';
import { assertProductionDetails } from './src/features/legal/productionGuard';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const readJson = (path: string) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

function appVersion(): string {
  try {
    return readFileSync(join(repoRoot, 'VERSION'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
}

function shortCommit(): string {
  if (process.env.VITE_COMMIT) return process.env.VITE_COMMIT.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Open-source licences of the packages the web app ships (shown on the About page).
const licences = listLicences(readJson(join(here, 'package.json')) ?? {}, (name) => {
  const path = join(here, 'node_modules', name, 'package.json');
  return existsSync(path) ? readJson(path) : undefined;
});

export default defineConfig(({ command, mode }) => {
  // A production build without the operator details must fail (workstream G, decision 0003).
  if (command === 'build')
    assertProductionDetails({ ...loadEnv(mode, here, 'VITE_'), ...process.env });
  return config;
});

/** Identifies this build; the app compares it with /version.json to spot a newer deploy. */
const buildId = `${appVersion()}-${shortCommit()}`;

/** Writes /version.json next to the app, so a running copy can tell a newer one was deployed. */
const versionFile = {
  name: 'revisionden-version-file',
  generateBundle(this: {
    emitFile: (file: { type: 'asset'; fileName: string; source: string }) => void;
  }) {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ build: buildId })}\n`,
    });
  },
};

const config: UserConfig = {
  plugins: [react(), versionFile],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __COMMIT__: JSON.stringify(shortCommit()),
    __LICENCES__: JSON.stringify(licences),
  },
  server: {
    // The policies (docs/legal) and CHANGELOG.md live at the repository root.
    fs: { allow: [repoRoot] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/test/**',
        'src/main.tsx',
        'src/mocks/browser.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
};
