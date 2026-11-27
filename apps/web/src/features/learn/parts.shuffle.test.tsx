import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRng, type LearnItem } from '@revisionden/core';
import { ItemInput } from './parts';
import { ShuffleProvider, useServedOptionOrder } from './shuffle';

/** A made-up multiple choice question (not educational content). */
const item: LearnItem = {
  id: '00000000-0000-4000-8000-000000000f22',
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  draft: true,
  type: 'multiple_choice',
  prompt: 'Demo pick one',
  options: ['Demo right', 'Demo b', 'Demo c', 'None of these'],
} as LearnItem;

const shown = () => screen.getAllByRole('radio').map((r) => r.closest('label')!.textContent);

describe('multiple choice options in a fresh order (F22)', () => {
  it('shows the options shuffled, with "None of these" kept last', () => {
    // Seed 1 moves the first option away from the top (checked with shuffledOptionOrder).
    render(
      <ShuffleProvider rng={createRng(1)}>
        <ItemInput item={item} draft={null} disabled={false} onChange={() => {}} />
      </ShuffleProvider>,
    );
    const order = shown();
    expect(order).toHaveLength(4);
    expect(order[0]).not.toBe('Demo right');
    expect(order[3]).toBe('None of these');
    expect([...order].sort()).toEqual(['Demo b', 'Demo c', 'Demo right', 'None of these']);
  });

  it('answers with the option itself (its original place), wherever it was shown', async () => {
    const onChange = vi.fn();
    render(
      <ShuffleProvider rng={createRng(1)}>
        <ItemInput item={item} draft={null} disabled={false} onChange={onChange} />
      </ShuffleProvider>,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Demo right' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    await userEvent.click(screen.getByRole('radio', { name: 'Demo c' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('marks the chosen and right options by the option, not by where it shows', () => {
    render(
      <ShuffleProvider rng={createRng(1)}>
        <ItemInput
          item={item}
          draft={0}
          disabled
          onChange={() => {}}
          optionMark={(index) => ({ right: index === 0 })}
        />
      </ShuffleProvider>,
    );
    const right = screen.getByRole('radio', { name: 'Demo right' });
    expect(right).toBeChecked();
    expect(right.closest('label')).toHaveClass('answer-option--right');
  });
});

describe('a fresh order for each serve (F22, Codex on #448)', () => {
  it('draws a new order when the same question is served again', () => {
    const rng = createRng(5);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShuffleProvider rng={rng}>{children}</ShuffleProvider>
    );
    const { result, rerender } = renderHook(({ serve }) => useServedOptionOrder(item, serve), {
      wrapper,
      initialProps: { serve: 0 },
    });
    const first = result.current;
    rerender({ serve: 0 });
    expect(result.current).toBe(first); // steady while on screen
    const orders = new Set([JSON.stringify(first)]);
    for (let serve = 1; serve < 8; serve += 1) {
      rerender({ serve });
      orders.add(JSON.stringify(result.current));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('has no order for a question that is not multiple choice', () => {
    const { result } = renderHook(() =>
      useServedOptionOrder({ ...item, type: 'short_answer' } as LearnItem, 0),
    );
    expect(result.current).toBeUndefined();
  });
});
