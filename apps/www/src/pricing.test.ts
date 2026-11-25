import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPricing } from './pricing.ts';

const doc = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs/PRICING.md'), 'utf8');

describe('planned prices from docs/PRICING.md', () => {
  it('reads the per-child Premium prices in sibling order', () => {
    expect(readPricing(doc).perChild).toEqual([
      { child: '1st', price: '£9.99', familyTotal: '£9.99' },
      { child: '2nd', price: '£4.99', familyTotal: '£14.98' },
      { child: '3rd', price: '£2.99', familyTotal: '£17.97' },
      { child: '4th and more', price: 'Free', familyTotal: '£17.97 at most' },
    ]);
  });

  it('reads the annual price and the free trial length', () => {
    expect(readPricing(doc).annualFirstChild).toBe('£79.99');
    expect(readPricing(doc).trialDays).toBe(14);
  });

  it('follows the document when a price changes', () => {
    const changed = doc.replace('| 1st                 | £9.99 ', '| 1st                 | £8.99 ');
    expect(readPricing(changed).perChild[0]!.price).toBe('£8.99');
  });

  it('refuses a document without the price table', () => {
    expect(() => readPricing('# Pricing\n')).toThrow(/docs\/PRICING\.md/);
  });
});
