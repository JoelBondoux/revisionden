import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokens } from '../design/tokens';

const webRoot = join(__dirname, '..', '..');
const manifest = JSON.parse(
  readFileSync(join(webRoot, 'public', 'manifest.webmanifest'), 'utf8'),
) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};
const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');

describe('web app manifest', () => {
  it('names the app', () => {
    expect(manifest.name).toBe('RevisionDen');
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('opens full screen from the home screen at the start of the app', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('uses the brand violet as the theme colour', () => {
    expect(manifest.theme_color.toLowerCase()).toBe(tokens['--color-primary'].toLowerCase());
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('has 192px and 512px PNG icons, including a maskable one, that exist', () => {
    const sizes = manifest.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose?.includes('maskable'))).toBe(true);
    for (const icon of manifest.icons) {
      expect(existsSync(join(webRoot, 'public', icon.src)), icon.src).toBe(true);
    }
  });

  it('is linked from the page with a theme colour and an iPad home screen icon', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#6C47F5"/i);
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable"');
    expect(existsSync(join(webRoot, 'public', 'icons', 'apple-touch-icon.png'))).toBe(true);
  });
});
