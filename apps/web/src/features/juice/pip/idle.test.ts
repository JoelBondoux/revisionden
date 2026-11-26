import { IDLE_GAP_MS, IDLE_STOP_MS, nextIdle } from './idle';

// J15b (owner defaults, 2026-11-26), J15b-2 (Pip v3, smoother idle with no arm): Pip acts about every 8 seconds, one action at a time, and stops
// after a minute without input. Outside study hours he naps. Never in a lesson or test, and with
// reduced motion he holds a still pose.
const base = {
  idleMs: 0,
  hour: 16,
  last: 'rest' as const,
  random: () => 0.5,
  calm: false,
  reducedMotion: false,
};

describe("Pip's idle loop", () => {
  it('waits about 8 seconds between actions', () => {
    expect(IDLE_GAP_MS).toBe(8000);
    const { delayMs } = nextIdle(base);
    expect(delayMs).toBeGreaterThanOrEqual(7000);
    expect(delayMs).toBeLessThanOrEqual(9000);
  });

  it('picks an action, never the same one twice in a row', () => {
    const first = nextIdle({ ...base, random: () => 0 });
    expect(['blink', 'tilt', 'ears', 'look']).toContain(first.pose);
    const again = nextIdle({ ...base, last: first.pose, random: () => 0 });
    expect(again.pose).not.toBe(first.pose);
  });

  it('stops after a minute without input', () => {
    expect(IDLE_STOP_MS).toBe(60_000);
    expect(nextIdle({ ...base, idleMs: 60_001 })).toEqual({ pose: 'rest', delayMs: null });
  });

  it('naps outside study hours', () => {
    expect(nextIdle({ ...base, hour: 22 }).pose).toBe('nap');
    expect(nextIdle({ ...base, hour: 6 }).pose).toBe('nap');
  });

  it('keeps still in a lesson or test, and with reduced motion', () => {
    expect(nextIdle({ ...base, calm: true })).toEqual({ pose: 'rest', delayMs: null });
    expect(nextIdle({ ...base, reducedMotion: true })).toEqual({ pose: 'rest', delayMs: null });
  });
});
