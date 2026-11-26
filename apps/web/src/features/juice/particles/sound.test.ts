import { BURST_SOUND_GAP_MS, burstSoundDue, eventOr } from './sound';

describe('juice sounds (J17, U8 lands in any order)', () => {
  it('uses the named event once it is registered', () => {
    expect(eventOr(['nodePop', 'prizeBox'], 'prizeBox', 'nodePop')).toBe('prizeBox');
  });

  it('falls back while the event is not registered yet', () => {
    expect(eventOr(['nodePop', 'rewardUnlock'], 'prizeBox', 'nodePop')).toBe('nodePop');
  });

  it('can stay silent instead while the event is not registered', () => {
    expect(eventOr(['nodePop'], 'particleBurst', null)).toBeNull();
  });

  it('plays the burst sound at most once every 140 ms', () => {
    expect(BURST_SOUND_GAP_MS).toBe(140);
    expect(burstSoundDue(1000, null)).toBe(true);
    expect(burstSoundDue(1100, 1000)).toBe(false);
    expect(burstSoundDue(1141, 1000)).toBe(true);
  });
});
