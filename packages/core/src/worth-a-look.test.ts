import { describe, expect, it } from 'vitest';
import { WorthALookSchema, groupWorthALook } from './worth-a-look';

const row = (learningPoint: string, topicId: string, topicTitle: string) => ({
  learningPoint,
  topicId,
  topicTitle,
});

describe('worth a look together', () => {
  it('lists each topic once, with how many tricky points it has', () => {
    const result = groupWorthALook([
      row('lp-b', 't-ratio', 'Ratio'),
      row('lp-a', 't-algebra', 'Linear equations'),
      row('lp-c', 't-ratio', 'Ratio'),
    ]);
    expect(result).toEqual({
      topics: [
        { topicId: 't-algebra', title: 'Linear equations', points: 1 },
        { topicId: 't-ratio', title: 'Ratio', points: 2 },
      ],
    });
  });

  it('is empty when nothing has been tricky for a while', () => {
    expect(groupWorthALook([])).toEqual({ topics: [] });
  });

  it('never carries the learning point ids, only topics a parent can read', () => {
    const result = groupWorthALook([row('lp-secret-id', 't1', 'Fractions')]);
    expect(JSON.stringify(result)).not.toContain('lp-secret-id');
    expect(WorthALookSchema.parse(result)).toEqual(result);
  });

  it('rejects a topic with no tricky points', () => {
    expect(() =>
      WorthALookSchema.parse({ topics: [{ topicId: 't1', title: 'Fractions', points: 0 }] }),
    ).toThrow();
  });
});
