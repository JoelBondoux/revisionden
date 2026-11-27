import { describe, expect, it } from 'vitest';
import {
  BUG_BUTTON_PAUSE_DAYS,
  BUG_BUTTON_PAUSES_BEFORE_REMOVAL,
  BUG_BUTTON_REMOVAL_WINDOW_DAYS,
  NOT_A_BUG_LIMIT,
  NOT_A_BUG_WINDOW_DAYS,
  bugButtonState,
} from './bug-button';

const DAY = 24 * 60 * 60 * 1000;
const start = new Date('2026-11-02T10:00:00Z');
const at = (days: number, ms = 0) => new Date(start.getTime() + days * DAY + ms);

describe('bugButtonState', () => {
  it('keeps the numbers in one place: 3 in 14 days pauses for 7 days; 3 pauses in 90 days removes', () => {
    expect([NOT_A_BUG_LIMIT, NOT_A_BUG_WINDOW_DAYS, BUG_BUTTON_PAUSE_DAYS]).toEqual([3, 14, 7]);
    expect([BUG_BUTTON_PAUSES_BEFORE_REMOVAL, BUG_BUTTON_REMOVAL_WINDOW_DAYS]).toEqual([3, 90]);
  });

  it('is on with no Not-a-bug outcomes, and with two', () => {
    expect(bugButtonState({ notABugAt: [], now: at(0) })).toEqual({ state: 'on' });
    expect(bugButtonState({ notABugAt: [at(0), at(1)], now: at(2) })).toEqual({ state: 'on' });
  });

  it('pauses for 7 days from the third Not-a-bug within 14 days', () => {
    const notABugAt = [at(0), at(5), at(10)];
    expect(bugButtonState({ notABugAt, now: at(10) })).toEqual({ state: 'paused', until: at(17) });
    expect(bugButtonState({ notABugAt, now: at(17, -1) })).toEqual({
      state: 'paused',
      until: at(17),
    });
  });

  it('switches back on exactly 7 days after the third', () => {
    expect(bugButtonState({ notABugAt: [at(0), at(5), at(10)], now: at(17) })).toEqual({
      state: 'on',
    });
  });

  it('counts a third exactly 14 days after the first, but not a moment later', () => {
    expect(bugButtonState({ notABugAt: [at(0), at(7), at(14)], now: at(14) })).toEqual({
      state: 'paused',
      until: at(21),
    });
    expect(bugButtonState({ notABugAt: [at(0), at(7), at(14, 1)], now: at(15) })).toEqual({
      state: 'on',
    });
  });

  it('uses a rolling window: an old one drops out and the next three still count', () => {
    // 0 is too old for 15 and 16, but 2, 15 and 16 are within 14 days.
    expect(bugButtonState({ notABugAt: [at(0), at(2), at(15), at(16)], now: at(16) })).toEqual({
      state: 'paused',
      until: at(23),
    });
  });

  it('does not count the outcomes behind a pause again', () => {
    // 0, 1, 2 pause the button; 3 and 4 are only two new ones.
    expect(bugButtonState({ notABugAt: [at(0), at(1), at(2), at(3), at(4)], now: at(10) })).toEqual(
      { state: 'on' },
    );
  });

  it('removes the button for good at the third pause within 90 days', () => {
    const notABugAt = [0, 1, 2, 30, 31, 32, 60, 61, 62].map((d) => at(d));
    expect(bugButtonState({ notABugAt, now: at(62) })).toEqual({ state: 'removed' });
    expect(bugButtonState({ notABugAt, now: at(400) })).toEqual({ state: 'removed' });
  });

  it('pauses rather than removes when the third pause is more than 90 days after the first', () => {
    // Pauses start at days 2, 47 and 92 plus a moment: just over 90 days apart.
    const notABugAt = [0, 1, 2, 45, 46, 47, 90, 91].map((d) => at(d)).concat(at(92, 1));
    expect(bugButtonState({ notABugAt, now: at(93) })).toEqual({
      state: 'paused',
      until: at(99, 1),
    });
    const exactly = [0, 1, 2, 45, 46, 47, 88, 90, 92].map((d) => at(d));
    expect(bugButtonState({ notABugAt: exactly, now: at(92) })).toEqual({ state: 'removed' });
  });

  it('ignores outcomes from before a parent or operator switched the button back on', () => {
    const notABugAt = [0, 1, 2, 30, 31, 32, 60, 61, 62].map((d) => at(d));
    expect(bugButtonState({ notABugAt, resetAt: at(62), now: at(63) })).toEqual({ state: 'on' });
    expect(
      bugButtonState({ notABugAt: [at(0), at(1), at(2)], resetAt: at(2, -1), now: at(3) }),
    ).toEqual({ state: 'on' });
  });

  it('ignores outcomes later than now and accepts them in any order', () => {
    expect(bugButtonState({ notABugAt: [at(10), at(0), at(5)], now: at(11) })).toEqual({
      state: 'paused',
      until: at(17),
    });
    expect(bugButtonState({ notABugAt: [at(0), at(1), at(2)], now: at(1) })).toEqual({
      state: 'on',
    });
  });
});
