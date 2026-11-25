import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingProvider } from './ReadingProvider';
import { ReadingSettingsCard } from './ReadingSettingsCard';
import { READING_KEY } from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function setup(initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial);
  const root = document.createElement('html');
  render(
    <ReadingProvider storage={storage} root={root}>
      <ReadingSettingsCard />
    </ReadingProvider>,
  );
  return { storage, root };
}

describe('Reading comfort settings card', () => {
  it('shows the four options with the defaults chosen', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Reading comfort' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /dyslexia-friendly font/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /more space between lines and letters/i }),
    ).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'No tint' })).toBeChecked();
  });

  it('applies a change across the app at once and remembers it on this device', async () => {
    const { storage, root } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /dyslexia-friendly font/i }));
    await userEvent.click(screen.getByRole('radio', { name: 'Larger' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /more space/i }));
    await userEvent.click(screen.getByRole('radio', { name: 'Cream' }));
    expect(root.dataset.readingFont).toBe('dyslexic');
    expect(root.dataset.readingSize).toBe('larger');
    expect(root.dataset.readingSpacing).toBe('wide');
    expect(root.dataset.readingTint).toBe('cream');
    expect(JSON.parse(storage.data.get(READING_KEY) ?? '{}')).toEqual({
      font: 'dyslexic',
      textSize: 'larger',
      spacing: 'wide',
      tint: 'cream',
    });
  });

  it('applies saved settings as soon as the app opens', () => {
    const { root } = setup({
      [READING_KEY]: '{"font":"dyslexic","textSize":"large","spacing":"normal","tint":"blue"}',
    });
    expect(root.dataset.readingFont).toBe('dyslexic');
    expect(root.dataset.readingSize).toBe('large');
    expect(root.dataset.readingTint).toBe('blue');
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();
  });

  it('says the font is built in, so nothing is downloaded from another site', () => {
    setup();
    expect(screen.getByText(/saved on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/OpenDyslexic/)).toBeInTheDocument();
  });
});
