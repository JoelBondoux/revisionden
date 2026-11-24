/**
 * Guard rails from docs/REWARDS.md: rewards never come from time spent or late-night study, there
 * are no random or loot-box mechanics, and avatar items only unlock when earned.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE, DEFAULT_AVATAR, encodeAvatar, validateAvatar } from './avatar';
import { REWARD_STAT_KEYS, REWARDS, evaluateRewards, progressionStats } from './rewards';

describe('rewards never come from time spent', () => {
  it('has no reward stat that measures time, sessions or app opens', () => {
    for (const key of REWARD_STAT_KEYS) {
      expect(key).not.toMatch(/time|minute|second|hour|duration|session|login|open|screen/i);
    }
  });

  it('has no reward whose target is a time measure', () => {
    for (const r of REWARDS) {
      if (r.target.kind === 'stat') expect(REWARD_STAT_KEYS).toContain(r.target.stat);
    }
  });
});

describe('rewards never come from late-night study', () => {
  it('gives no level or chapter progress for XP earned at 23:00 UK time', () => {
    const stats = progressionStats({
      xpEvents: [{ at: new Date('2026-11-20T23:00:00Z'), xp: 5000 }],
      yearGroup: 10,
      today: '2026-11-24',
    });
    expect(stats.level).toBe(1);
    expect(stats.chapter2Xp).toBe(0);
    expect(evaluateRewards(stats, [], REWARDS, { now: new Date() })).toEqual([]);
  });
});

describe('no random or loot-box mechanics', () => {
  it('gives the same rewards for the same progress every time', () => {
    const stats = { level: 30, bestStreak: 200, chapter3Xp: 5000, correctAnswers: 3000 };
    const now = new Date('2026-11-24T12:00:00Z');
    const a = evaluateRewards(stats, [], REWARDS, { now, seasonProgress: { 'autumn-2-2026': 90 } });
    const b = evaluateRewards(stats, [], REWARDS, { now, seasonProgress: { 'autumn-2-2026': 90 } });
    expect(a).toEqual(b);
  });

  it('states a fixed target for every reward', () => {
    for (const r of REWARDS) expect(['stat', 'collection', 'season']).toContain(r.target.kind);
  });

  it('uses no randomness anywhere in the rewards code', () => {
    const dir = __dirname;
    const files = [
      'rewards.ts',
      'levels.ts',
      'chapters.ts',
      'reward-xp.ts',
      ...readdirSync(join(dir, 'catalogue'))
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .map((f) => join('catalogue', f)),
    ];
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      expect(source, file).not.toMatch(/Math\.random|createRng|crypto|loot|chance|probability/i);
    }
  });
});

describe('avatar items only unlock when earned', () => {
  it('rejects every reward-locked avatar item until its reward is earned', () => {
    for (const r of REWARDS) {
      for (const item of r.items) {
        if (item.kind !== 'avatar') continue;
        const index = AVATAR_CATALOGUE[item.layer].findIndex((a) => a.id === item.id);
        const code = encodeAvatar({ ...DEFAULT_AVATAR, [item.layer]: index });
        expect(validateAvatar(code, []).ok, `${item.layer}:${item.id}`).toBe(false);
        expect(validateAvatar(code, [r.id]).ok, `${item.layer}:${item.id}`).toBe(true);
      }
    }
  });
});
