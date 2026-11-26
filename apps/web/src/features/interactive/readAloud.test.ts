import type { LearnItem } from '@revisionden/core';
import { itemSpeechText } from '../read-aloud/maths';

describe('read aloud for an area model step (W8)', () => {
  it('reads the prompt, then the pairs to choose from', () => {
    const item: LearnItem = {
      id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      topicId: 'gcse-maths-h-a4',
      topicTitle: 'Simplifying, expanding and factorising',
      draft: false,
      type: 'area_model',
      mode: 'explore',
      prompt: 'Make x^2 + 5x + 6 into a rectangle.',
      quadratic: { b: 5, c: 6 },
    };
    expect(itemSpeechText(item)).toBe(
      'Make x squared plus 5x plus 6 into a rectangle. Choose two numbers: 1 and 6, or 2 and 3.',
    );
  });
});
