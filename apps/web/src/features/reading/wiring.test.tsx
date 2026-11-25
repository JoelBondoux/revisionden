import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { listLicences } from '../about/licences';
import { renderRoute } from '../../test/render';

const webRoot = join(__dirname, '..', '..', '..');
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, never>;

describe('reading comfort wiring', () => {
  it('shows the Reading comfort section in Settings', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('heading', { name: 'Reading comfort' })).toBeInTheDocument();
  });

  it('lists the self-hosted dyslexia-friendly font under the open-source licences', () => {
    const licences = listLicences(readJson(join(webRoot, 'package.json')), (name) =>
      readJson(join(webRoot, 'node_modules', name, 'package.json')),
    );
    expect(licences).toContainEqual(
      expect.objectContaining({ name: '@fontsource/opendyslexic', licence: 'OFL-1.1' }),
    );
  });
});
