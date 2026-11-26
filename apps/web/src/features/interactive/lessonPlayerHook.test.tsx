import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LearnItem } from '@revisionden/core';
import { ItemInput, toAnswer } from '../learn/parts';

const item: LearnItem = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  topicId: 'gcse-maths-h-a4',
  topicTitle: 'Simplifying, expanding and factorising',
  draft: false,
  type: 'area_model',
  mode: 'guided',
  prompt: 'Make x^2 + 6x + 8 into a rectangle.',
  quadratic: { b: 6, c: 8 },
};

describe('the lesson player shows an area model step (W8 hook)', () => {
  it('renders the tiles and pairs, and the chosen pair is the answer sent', async () => {
    const onChange = vi.fn();
    render(<ItemInput item={item} draft={null} disabled={false} onChange={onChange} />);
    expect(
      screen.getByRole('radiogroup', { name: /multiply to 8 and add to 6/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '2 and 4' }));
    expect(onChange).toHaveBeenCalledWith('2,4');
    expect(toAnswer(item, '2,4')).toBe('2,4');
  });
});
