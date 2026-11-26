import { FEEDBACK_EVENTS } from './events';
import { createWebHaptics, hapticPattern } from './haptics';
import { FEEDBACK_STYLES } from './styles';

describe('haptics', () => {
  it('vibrates through navigator.vibrate where it exists', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createWebHaptics({ vibrate });
    expect(haptics.supported).toBe(true);
    haptics.vibrate([10, 20, 10]);
    expect(vibrate).toHaveBeenCalledWith([10, 20, 10]);
  });

  it('does nothing, silently, where vibration is missing (iPhone and iPad)', () => {
    const haptics = createWebHaptics({});
    expect(haptics.supported).toBe(false);
    expect(() => haptics.vibrate([10])).not.toThrow();
    expect(createWebHaptics(undefined).supported).toBe(false);
    const throwing = createWebHaptics({
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(() => throwing.vibrate([10])).not.toThrow();
  });

  it('a light tick for presses and flips, a double pulse for correct, longer for big moments', () => {
    for (const style of FEEDBACK_STYLES) {
      const press = hapticPattern(style, 'buttonPress')!;
      const flip = hapticPattern(style, 'cardFlip')!;
      const correct = hapticPattern(style, 'correct')!;
      const unlock = hapticPattern(style, 'rewardUnlock')!;
      const level = hapticPattern(style, 'levelUp')!;
      expect(press).toHaveLength(1);
      expect(press[0]).toBeLessThanOrEqual(15);
      expect(flip).toHaveLength(1);
      // Double pulse: buzz, pause, buzz.
      expect(correct).toHaveLength(3);
      const total = (p: number[]) => p.reduce((a, b) => a + b, 0);
      expect(total(unlock)).toBeGreaterThan(total(correct));
      expect(total(level)).toBeGreaterThan(total(correct));
      expect(total(level)).toBeLessThanOrEqual(600);
    }
  });

  it('combo patterns rise: more and longer pulses for bigger combos', () => {
    for (const style of FEEDBACK_STYLES) {
      const two = hapticPattern(style, 'combo', 2)!;
      const six = hapticPattern(style, 'combo', 6)!;
      expect(six.length).toBeGreaterThanOrEqual(two.length);
      expect(Math.max(...six)).toBeGreaterThan(Math.max(...two));
      expect(hapticPattern(style, 'combo', 60)).toEqual(six);
    }
  });

  it('no buzzing for fast ticks', () => {
    for (const style of FEEDBACK_STYLES) {
      expect(hapticPattern(style, 'xpTick')).toBeNull();
      expect(hapticPattern(style, 'ringFill')).toBeNull();
      expect(hapticPattern(style, 'nodePop')).toBeNull();
    }
  });

  it('Home entrance is a light tick; a locked tap is one short buzz', () => {
    for (const style of FEEDBACK_STYLES) {
      const home = hapticPattern(style, 'homeEnter')!;
      const locked = hapticPattern(style, 'locked')!;
      expect(home).toHaveLength(1);
      expect(home[0]).toBeLessThanOrEqual(15);
      expect(locked).toHaveLength(1);
      expect(locked[0]).toBeGreaterThan(home[0]!);
      expect(locked[0]).toBeLessThanOrEqual(40);
    }
  });

  it('styles feel different', () => {
    const sigs = new Set(FEEDBACK_STYLES.map((s) => JSON.stringify(hapticPattern(s, 'correct'))));
    expect(sigs.size).toBe(FEEDBACK_STYLES.length);
    expect(FEEDBACK_EVENTS.length).toBeGreaterThan(10);
  });
});
