import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  batchOutcome,
  drawSample,
  sampleSize,
  samplingRule,
  templateApproved,
} from './review-sampling';

describe('sampleSize', () => {
  it('reviews 10% of a large batch', () => {
    expect(sampleSize(1000)).toBe(100);
    expect(sampleSize(305)).toBe(31);
  });

  it('reviews at least 30 items', () => {
    expect(sampleSize(100)).toBe(30);
    expect(sampleSize(299)).toBe(30);
  });

  it('reviews every item of a batch smaller than 30', () => {
    expect(sampleSize(12)).toBe(12);
    expect(sampleSize(0)).toBe(0);
  });
});

const batch = (n: number, needsApproval: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `item-${i}`,
    needsHumanApproval: needsApproval.includes(i),
  }));

describe('drawSample', () => {
  it('draws the sample size from the batch without repeats', () => {
    const sample = drawSample(batch(500), createRng(1));
    expect(sample).toHaveLength(50);
    expect(new Set(sample).size).toBe(50);
  });

  it('is repeatable with the same seed and different with another', () => {
    expect(drawSample(batch(500), createRng(7))).toEqual(drawSample(batch(500), createRng(7)));
    expect(drawSample(batch(500), createRng(7))).not.toEqual(drawSample(batch(500), createRng(8)));
  });

  it('always includes items that need human approval, on top of the random sample', () => {
    const sample = drawSample(batch(400, [3, 250]), createRng(2));
    expect(sample).toContain('item-3');
    expect(sample).toContain('item-250');
    expect(sample).toHaveLength(42);
  });

  it('keeps the batch order so reviewers see items in a stable order', () => {
    const sample = drawSample(batch(400), createRng(3));
    const order = sample.map((id) => Number(id.split('-')[1]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('takes the whole batch when it is small', () => {
    expect(drawSample(batch(5), createRng(4))).toEqual(batch(5).map((i) => i.itemId));
  });
});

describe('batchOutcome', () => {
  it('passes only when every sampled item is approved', () => {
    expect(batchOutcome(['approved', 'approved'])).toBe('passed');
  });

  it('fails as soon as one sampled item has a confirmed error', () => {
    expect(batchOutcome(['approved', 'confirmed_error', null])).toBe('failed');
  });

  it('stays in review while any sampled item is undecided', () => {
    expect(batchOutcome(['approved', null])).toBe('in_review');
  });

  it('an empty sample cannot pass', () => {
    expect(batchOutcome([])).toBe('in_review');
  });
});

// Decision 0010: template-only batches are sampled at 3%, at least 10.
const templateItem = (overrides: Record<string, unknown> = {}) => ({
  type: 'numeric',
  template: { id: 'gcse-maths-h-n12-percentage-change', version: 2, seed: 1 },
  verification: {
    status: 'draft',
    checks: [
      { name: 'maths-engine', result: 'pass' },
      {
        name: 'template-approval',
        result: 'pass',
        tool: 'content-lead',
        tool_version: 'gcse-maths-h-n12-percentage-change v2',
      },
    ],
  },
  ...overrides,
});

describe('template sampling (decision 0010)', () => {
  it('reviews 3% of a template-only batch, at least 10', () => {
    expect(sampleSize(1000, 'template')).toBe(30);
    expect(sampleSize(300, 'template')).toBe(10);
    expect(sampleSize(6, 'template')).toBe(6);
  });

  it('keeps the standard rule by default', () => {
    expect(sampleSize(300)).toBe(30);
    expect(sampleSize(300, 'standard')).toBe(30);
  });

  it('draws the template sample size from a template-only batch', () => {
    expect(drawSample(batch(500), createRng(1), 'template')).toHaveLength(15);
  });

  it('approves an item from a template whose preview was approved and cross-check passed', () => {
    expect(templateApproved(templateItem())).toBe(true);
  });

  it('does not count an unapproved template', () => {
    const item = templateItem();
    item.verification.checks = item.verification.checks.filter(
      (c) => c.name !== 'template-approval',
    );
    expect(templateApproved(item)).toBe(false);
  });

  it('does not count an approval for another template version', () => {
    expect(
      templateApproved(
        templateItem({
          template: { id: 'gcse-maths-h-n12-percentage-change', version: 3, seed: 1 },
        }),
      ),
    ).toBe(false);
  });

  it('does not count a template item whose cross-check failed', () => {
    const item = templateItem();
    item.verification.checks[0] = { name: 'maths-engine', result: 'fail' };
    expect(templateApproved(item)).toBe(false);
  });

  it('does not count a hand-written item', () => {
    expect(templateApproved(templateItem({ template: undefined }))).toBe(false);
  });

  it('uses the template rule only when every item is from an approved template', () => {
    expect(samplingRule([templateItem(), templateItem()])).toBe('template');
    expect(samplingRule([templateItem(), templateItem({ template: undefined })])).toBe('standard');
    expect(samplingRule([])).toBe('standard');
  });
});
