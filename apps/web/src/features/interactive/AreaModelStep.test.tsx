import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import type { LearnItem } from '@revisionden/core';
import { AreaModelStep } from './AreaModelStep';

type AreaItem = Extract<LearnItem, { type: 'area_model' }>;

const item = (overrides: Partial<AreaItem> = {}): AreaItem => ({
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  topicId: 'gcse-maths-h-a4',
  topicTitle: 'Simplifying, expanding and factorising',
  draft: false,
  type: 'area_model',
  mode: 'explore',
  prompt: 'Make x^2 + 5x + 6 into a rectangle.',
  quadratic: { b: 5, c: 6 },
  ...overrides,
});

/** The step inside a parent that keeps the draft, as the lesson player does. */
function Harness({ step, disabled = false }: { step: AreaItem; disabled?: boolean }) {
  const [draft, setDraft] = useState('');
  return (
    <>
      <AreaModelStep
        item={step}
        draft={draft}
        disabled={disabled}
        onChange={(d) => setDraft(String(d))}
      />
      <span data-testid="draft">{draft}</span>
    </>
  );
}

describe('the area model step', () => {
  it('never adds or removes tiles: a wrong pair keeps b strips and c units (Codex P2)', async () => {
    render(<Harness step={item()} />);
    await userEvent.click(screen.getByRole('radio', { name: '1 and 6' }));
    const svg = document.querySelector('.area-svg')!;
    expect(svg.querySelectorAll('.area-tile--strip')).toHaveLength(5);
    expect(svg.querySelectorAll('.area-tile--unit')).toHaveLength(6);
    // The frame for 1 and 6 wants 7 strips: the 2 missing ones are outlined, not drawn.
    expect(svg.querySelectorAll('.area-slot--missing')).toHaveLength(2);
    await userEvent.click(screen.getByRole('radio', { name: '2 and 3' }));
    expect(svg.querySelectorAll('.area-tile--strip')).toHaveLength(5);
    expect(svg.querySelectorAll('.area-slot--missing')).toHaveLength(0);
  });

  it('shows the prompt and the quadratic as three terms', () => {
    render(<Harness step={item()} />);
    // The prompt shows the power as a superscript, never a typed ^ (F9), and reads it aloud.
    const prompt = document.querySelector('.question__prompt')!;
    expect(prompt.querySelector('sup')).toHaveTextContent('2');
    expect(prompt.querySelector('[aria-hidden="true"]')).not.toHaveTextContent('^');
    expect(prompt).toHaveTextContent(/x squared/);
    const expr = screen.getByTestId('area-expression');
    expect(expr).toHaveTextContent('x² + 5x + 6');
  });

  it('offers every pair of numbers that multiply to c, as choices', () => {
    render(<Harness step={item()} />);
    const group = screen.getByRole('radiogroup', { name: /multiply to 6 and add to 5/ });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label') ?? r.closest('label')?.textContent),
    ).toEqual(['1 and 6', '2 and 3']);
  });

  it('turns the chosen pair into the answer, smaller number first', async () => {
    render(<Harness step={item()} />);
    await userEvent.click(screen.getByRole('radio', { name: '2 and 3' }));
    expect(screen.getByTestId('draft')).toHaveTextContent('2,3');
  });

  it('can be answered with the keyboard alone', async () => {
    render(<Harness step={item()} />);
    await userEvent.tab();
    // Tiles first, then the choices: tab until a radio has focus, then choose with the arrows.
    for (let i = 0; i < 20 && document.activeElement?.getAttribute('type') !== 'radio'; i++) {
      await userEvent.tab();
    }
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('draft')).toHaveTextContent('2,3');
  });

  it('lights up the matching term when a tile is tapped, and says what the tile is', async () => {
    render(<Harness step={item()} />);
    await userEvent.click(screen.getByRole('button', { name: 'The x² square' }));
    const term = screen.getByTestId('area-term-square');
    expect(term).toHaveClass('area-term--lit');
    expect(screen.getByRole('status')).toHaveTextContent('It is x by x, so its area is x².');
    await userEvent.click(screen.getAllByRole('button', { name: 'An x strip' })[0]!);
    expect(screen.getByTestId('area-term-strip')).toHaveClass('area-term--lit');
    expect(term).not.toHaveClass('area-term--lit');
  });

  it('works a tile with Enter or Space too', async () => {
    render(<Harness step={item()} />);
    screen.getAllByRole('button', { name: 'A unit square' })[0]!.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('area-term-unit')).toHaveClass('area-term--lit');
  });

  it('labels the sides x + q and x + p once a pair is chosen, in words as well as the picture', async () => {
    render(<Harness step={item()} />);
    await userEvent.click(screen.getByRole('radio', { name: '2 and 3' }));
    expect(screen.getByTestId('area-sides')).toHaveTextContent('The sides are x + 3 and x + 2.');
  });

  it('in explore mode, says at once whether the tiles make a rectangle', async () => {
    render(<Harness step={item()} />);
    await userEvent.click(screen.getByRole('radio', { name: '1 and 6' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 + 6 = 7, not 5');
    await userEvent.click(screen.getByRole('radio', { name: '2 and 3' }));
    expect(screen.getByRole('status')).toHaveTextContent('The tiles make a rectangle');
  });

  it('in guided mode, keeps the verdict for the Check button', async () => {
    render(<Harness step={item({ mode: 'guided' })} />);
    await userEvent.click(screen.getByRole('radio', { name: '1 and 6' }));
    expect(screen.getByRole('status')).not.toHaveTextContent(/not 5|rectangle/);
  });

  it('cannot be changed once the answer is checked', () => {
    render(<Harness step={item()} disabled />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});

describe('Did this help? (one tap, no text)', () => {
  it('is asked after the last tile step is checked, and sends only the tap and the item', async () => {
    const sent: unknown[] = [];
    server.use(
      http.post('*/v1/student/feedback', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    render(<Harness step={item({ askHelped: true })} disabled />);
    const group = screen.getByRole('group', { name: 'Did this help?' });
    await userEvent.click(within(group).getByRole('button', { name: 'Yes' }));
    expect(await screen.findByText('Thanks for telling us.')).toBeInTheDocument();
    expect(sent).toEqual([{ kind: 'lesson_helped', itemId: item().id }]);
  });

  it('sends "it did not help" for No', async () => {
    const sent: unknown[] = [];
    server.use(
      http.post('*/v1/student/feedback', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    render(<Harness step={item({ askHelped: true })} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    await screen.findByText('Thanks for telling us.');
    expect(sent).toEqual([{ kind: 'lesson_not_helped', itemId: item().id }]);
  });

  it('is not asked before the answer is checked, nor on steps without the flag', () => {
    const { unmount } = render(<Harness step={item({ askHelped: true })} />);
    expect(screen.queryByRole('group', { name: 'Did this help?' })).toBeNull();
    unmount();
    render(<Harness step={item()} disabled />);
    expect(screen.queryByRole('group', { name: 'Did this help?' })).toBeNull();
  });
});
