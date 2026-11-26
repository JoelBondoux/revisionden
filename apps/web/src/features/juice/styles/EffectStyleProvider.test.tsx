import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffectStyleProvider, useEffectStyle } from './EffectStyleProvider';
import { EFFECT_STYLE_KEY } from './registry';

function Probe() {
  const { style, styleId, choose } = useEffectStyle();
  return (
    <>
      <p>
        {style.name} ({styleId})
      </p>
      <button type="button" onClick={() => choose('sticker-book')}>
        Choose Sticker Book
      </button>
    </>
  );
}

describe('effect style provider', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.effectStyle;
  });

  it('applies Sticker Book to the page by default', () => {
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    expect(screen.getByText('Sticker Book (sticker-book)')).toBeInTheDocument();
    expect(document.documentElement.dataset.effectStyle).toBe('sticker-book');
  });

  it('falls back to Sticker Book when the saved style is not available', () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'neon-disco');
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    expect(document.documentElement.dataset.effectStyle).toBe('sticker-book');
  });

  it('remembers a choice on this device', async () => {
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Choose Sticker Book' }));
    expect(localStorage.getItem(EFFECT_STYLE_KEY)).toBe('sticker-book');
  });

  it('still gives the default style outside the provider', () => {
    render(<Probe />);
    expect(screen.getByText('Sticker Book (sticker-book)')).toBeInTheDocument();
  });
});
