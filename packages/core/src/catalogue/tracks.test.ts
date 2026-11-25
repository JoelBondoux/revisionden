import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE } from '../avatar';
import { HIDDEN_TRACK_NAMES } from '../rewards';
import { COLLECTIONS, REWARDS, SEASONS, validateCatalogue } from './index';

const steps = (track: string) =>
  REWARDS.filter((r) => r.track === track).map((r) => (r.target as { atLeast: number }).atLeast);

describe('more hidden tracks', () => {
  it('has the six tracks from REWARDS.md with their steps', () => {
    expect(steps('fact-checker')).toEqual([1, 2, 3, 5, 8]);
    expect(steps('comeback-kid')).toEqual([1, 3, 5, 10, 20, 35]);
    expect(steps('explorer')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps('planner')).toEqual([1, 4, 8, 16, 30]);
    expect(steps('pace-setter')).toEqual([1, 3, 6, 10]);
    expect(steps('perfectionist')).toEqual([1, 5, 15, 30, 60, 100]);
  });

  it('names every hidden track and keeps each on one learning stat', () => {
    const tracks = [...new Set(REWARDS.flatMap((r) => (r.track ? [r.track] : [])))];
    expect(tracks).toHaveLength(7);
    for (const track of tracks) {
      expect(HIDDEN_TRACK_NAMES[track]).toBeTruthy();
      const stats = new Set(
        REWARDS.filter((r) => r.track === track).map((r) => (r.target as { stat: string }).stat),
      );
      expect(stats.size).toBe(1);
    }
  });

  it('starts each track with a badge and ends it with an epic or legendary reward', () => {
    for (const track of [
      'fact-checker',
      'comeback-kid',
      'explorer',
      'planner',
      'pace-setter',
      'perfectionist',
    ]) {
      const list = REWARDS.filter((r) => r.track === track);
      expect(list[0]!.items[0]!.kind).toBe('badge');
      expect(['epic', 'legendary']).toContain(list.at(-1)!.rarity);
    }
  });

  it('passes the validator, so every step is reachable', () => {
    expect(
      validateCatalogue(REWARDS, {
        collections: COLLECTIONS,
        seasons: SEASONS,
        avatar: AVATAR_CATALOGUE,
      }),
    ).toEqual([]);
  });
});
