import { MORE_TIME_SECONDS, MORE_TIME_USES, canAddTime, secondsLeft } from './startingTestTime';

describe('starting test time (F17, WCAG 2.2.1 extend)', () => {
  it('adds two minutes a time, up to ten times', () => {
    expect(MORE_TIME_SECONDS).toBe(120);
    expect(MORE_TIME_USES).toBe(10);
  });

  it('counts down from the limit plus any extra time, never below zero', () => {
    expect(secondsLeft({ limitSeconds: 300, extraSeconds: 0, elapsedMs: 0 })).toBe(300);
    expect(secondsLeft({ limitSeconds: 300, extraSeconds: 0, elapsedMs: 1999 })).toBe(299);
    expect(secondsLeft({ limitSeconds: 300, extraSeconds: 120, elapsedMs: 250_000 })).toBe(170);
    expect(secondsLeft({ limitSeconds: 300, extraSeconds: 0, elapsedMs: 400_000 })).toBe(0);
  });

  it('offers more time only in the last minute, before time is up, and until it has been used ten times', () => {
    expect(canAddTime({ secondsLeft: 61, used: 0 })).toBe(false);
    expect(canAddTime({ secondsLeft: 60, used: 0 })).toBe(true);
    expect(canAddTime({ secondsLeft: 1, used: 9 })).toBe(true);
    expect(canAddTime({ secondsLeft: 0, used: 0 })).toBe(false);
    expect(canAddTime({ secondsLeft: 30, used: 10 })).toBe(false);
  });
});
