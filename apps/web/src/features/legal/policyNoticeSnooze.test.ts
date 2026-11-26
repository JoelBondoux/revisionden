import {
  isSnoozed,
  POLICY_NOTICE_KEY,
  POLICY_NOTICE_SNOOZE_MS,
  snooze,
} from './policyNoticeSnooze';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};
const t0 = Date.parse('2026-11-26T09:00:00Z');
const v = { 'privacy-notice': '1.10' };

describe('the closed policy notice', () => {
  it('stays hidden for 24 hours for the same versions', () => {
    const storage = memory();
    snooze(storage, v, t0);
    expect(isSnoozed(storage, v, t0 + POLICY_NOTICE_SNOOZE_MS - 1)).toBe(true);
    expect(isSnoozed(storage, v, t0 + POLICY_NOTICE_SNOOZE_MS)).toBe(false);
  });

  it('shows again for a different version or another policy', () => {
    const storage = memory();
    snooze(storage, v, t0);
    expect(isSnoozed(storage, { 'privacy-notice': '1.11' }, t0)).toBe(false);
    expect(isSnoozed(storage, { ...v, 'terms-of-use': '1.1' }, t0)).toBe(false);
  });

  it('shows when nothing usable is stored or storage is blocked', () => {
    const storage = memory();
    expect(isSnoozed(storage, v, t0)).toBe(false);
    storage.setItem(POLICY_NOTICE_KEY, 'not json');
    expect(isSnoozed(storage, v, t0)).toBe(false);
    expect(isSnoozed(undefined, v, t0)).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => snooze(blocked, v, t0)).not.toThrow();
    expect(isSnoozed(blocked, v, t0)).toBe(false);
  });
});
