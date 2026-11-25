/** Planned Premium prices, read from docs/PRICING.md at build time (decision 0004). */
export interface Pricing {
  perChild: { child: string; price: string; familyTotal: string }[];
  annualFirstChild: string;
  trialDays: number;
}

export function readPricing(doc: string): Pricing {
  const perChild = [
    ...doc.matchAll(/^\|\s*(1st|2nd|3rd|4th[^|]*?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm),
  ].map((row) => ({ child: row[1]!, price: row[2]!, familyTotal: row[3]! }));
  const annual = doc.match(/\*\*Annual plan:\*\*\s*about (£\d+\.\d\d) a year/)?.[1];
  const trial = doc.match(/\*\*(\d+)-day free trial\*\*/)?.[1];
  if (perChild.length < 4 || !annual || !trial) {
    throw new Error('Could not read the prices from docs/PRICING.md (table, annual plan, trial)');
  }
  return { perChild, annualFirstChild: annual, trialDays: Number(trial) };
}
