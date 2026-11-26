import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LearnItem } from '@revisionden/core';
import { ItemInput, type Draft } from './parts';

const base = { id: '00000000-0000-4000-8000-000000000301', topicTitle: 'Demo topic', draft: true };
const numeric: LearnItem = { ...base, topicId: 'demo-topic', type: 'numeric', prompt: 'Demo' };
const computing: LearnItem = {
  ...base,
  topicId: 'a-level-computer-science-demo',
  type: 'short_answer',
  prompt: 'Demo',
};

function Harness({ item }: { item: LearnItem }) {
  const [draft, setDraft] = useState<Draft>('');
  return <ItemInput item={item} draft={draft} disabled={false} onChange={setDraft} />;
}

describe('typing a power (F9)', () => {
  it('has a Power key that types ^ where the cursor is, then shows a preview', async () => {
    render(<Harness item={numeric} />);
    const box = screen.getByLabelText<HTMLInputElement>('Your answer');
    await userEvent.type(box, '102');
    box.setSelectionRange(2, 2);
    await userEvent.click(screen.getByRole('button', { name: /Power/ }));
    expect(box).toHaveValue('10^2');
    expect(box).toHaveFocus();
    const preview = screen.getByTestId('answer-preview');
    expect(preview.querySelector('sup')!.textContent).toBe('2');
  });

  it('shows no preview until there is a power to show', async () => {
    render(<Harness item={numeric} />);
    await userEvent.type(screen.getByLabelText('Your answer'), '12');
    expect(screen.queryByTestId('answer-preview')).not.toBeInTheDocument();
  });

  it('still takes ² typed straight in', async () => {
    render(<Harness item={numeric} />);
    await userEvent.type(screen.getByLabelText('Your answer'), 'x²');
    expect(screen.getByLabelText('Your answer')).toHaveValue('x²');
  });

  it('has no Power key or preview in computing, where ^ is a real symbol', async () => {
    render(<Harness item={computing} />);
    await userEvent.type(screen.getByLabelText('Your answer'), 'a^b');
    expect(screen.queryByRole('button', { name: /Power/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('answer-preview')).not.toBeInTheDocument();
  });
});

describe('typing a power in worked maths (F9)', () => {
  it('has the Power key under the working too', async () => {
    const worked: LearnItem = {
      ...base,
      topicId: 'demo-topic',
      type: 'worked_maths',
      prompt: 'Demo',
    };
    render(<Harness item={worked} />);
    await userEvent.type(screen.getByLabelText(/Your working/), 'x');
    await userEvent.click(screen.getByRole('button', { name: /Power/ }));
    expect(screen.getByLabelText(/Your working/)).toHaveValue('x^');
  });
});

describe('units (F9)', () => {
  it('raises the power in a unit beside the answer box', () => {
    const area: LearnItem = { ...numeric, unit: 'cm^2' } as LearnItem;
    const { container } = render(<Harness item={area} />);
    expect(container.querySelector('.field__unit sup')!.textContent).toBe('2');
  });
});
