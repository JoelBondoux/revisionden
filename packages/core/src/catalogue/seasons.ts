/**
 * Seasonal drops (see docs/REWARDS.md "Seasonal drops"): one per term, 8 items each, earned by
 * that term's challenge. Windows run back to back so a drop is always live, and each drop comes
 * back for the same term a year later. Ids are `<season>-<tier>`.
 */
import type { Rarity, Reward, RewardItem, Season } from './types';

const nextYear = (day: string) => `${Number(day.slice(0, 4)) + 1}${day.slice(4)}`;

const season = (
  id: string,
  name: string,
  start: string,
  end: string,
  measure: Season['measure'],
  challenge: string,
): Season => ({
  id,
  name,
  window: { start, end },
  rerelease: { start: nextYear(start), end: nextYear(end) },
  measure,
  challenge,
});

export const SEASONS: readonly Season[] = [
  season(
    'autumn-1-2026',
    'Kick-off',
    '2026-09-01',
    '2026-11-01',
    'correctAnswers',
    'Get answers right this half-term',
  ),
  season(
    'autumn-2-2026',
    'Frost Fest',
    '2026-11-02',
    '2027-01-03',
    'correctAnswers',
    'Get answers right this half-term',
  ),
  season(
    'spring-1-2027',
    'Winter Riffs',
    '2027-01-04',
    '2027-02-21',
    'correctAnswers',
    'Get answers right this half-term',
  ),
  season(
    'spring-2-2027',
    'Spring Session',
    '2027-02-22',
    '2027-04-11',
    'goalDays',
    'Hit your daily goal on lots of days',
  ),
  season(
    'summer-1-2027',
    'Exam Calm',
    '2027-04-12',
    '2027-06-06',
    'goalDays',
    'Hit your daily goal steadily: consistency, not cramming',
  ),
  season(
    'summer-2-2027',
    'Summer Fest',
    '2027-06-07',
    '2027-08-31',
    'correctAnswers',
    'Get answers right this summer',
  ),
];

const THRESHOLDS: Record<Season['measure'], readonly number[]> = {
  correctAnswers: [25, 50, 100, 150, 200, 300, 400, 500],
  goalDays: [3, 5, 8, 12, 16, 20, 25, 30],
};

const RARITY_BY_TIER: readonly Rarity[] = [
  'common',
  'common',
  'common',
  'rare',
  'rare',
  'rare',
  'epic',
  'epic',
];

type Drop = readonly [name: string, item: RewardItem];

const DROPS: Record<string, readonly Drop[]> = {
  'autumn-1-2026': [
    ['Kick-off sticker', { kind: 'badge', id: 'kick-off' }],
    ['Autumn leaves theme', { kind: 'theme', id: 'autumn-leaves' }],
    ['Conker frame', { kind: 'frame', id: 'conker' }],
    ['"New Term Energy" title', { kind: 'title', text: 'New Term Energy' }],
    ['Fresh kit badge', { kind: 'badge', id: 'fresh-kit' }],
    ['Pip striker outfit', { kind: 'pipOutfit', id: 'striker' }],
    ['Golden boot frame', { kind: 'frame', id: 'golden-boot' }],
    ['Pip kit captain outfit', { kind: 'pipOutfit', id: 'kit-captain' }],
  ],
  'autumn-2-2026': [
    ['Snowflake sticker', { kind: 'badge', id: 'snowflake' }],
    ['Bobble hat', { kind: 'avatar', layer: 'headwear', id: 'bobble-hat' }],
    ['Frosty frame', { kind: 'frame', id: 'frosty' }],
    ['"Frost Fighter" title', { kind: 'title', text: 'Frost Fighter' }],
    ['Paper lantern', { kind: 'avatar', layer: 'heldItem', id: 'lantern' }],
    ['Pip scarf outfit', { kind: 'pipOutfit', id: 'scarf' }],
    ['Firework theme', { kind: 'theme', id: 'firework' }],
    ['Frosty night scene', { kind: 'avatar', layer: 'scene', id: 'frosty-night' }],
  ],
  'spring-1-2027': [
    ['Plectrum sticker', { kind: 'badge', id: 'plectrum' }],
    ['Cold snap theme', { kind: 'theme', id: 'cold-snap' }],
    ['Pedalboard frame', { kind: 'frame', id: 'pedalboard' }],
    ['"Riff Machine" title', { kind: 'title', text: 'Riff Machine' }],
    ['Tour laminate badge', { kind: 'badge', id: 'tour-laminate' }],
    ['Pip parka outfit', { kind: 'pipOutfit', id: 'parka' }],
    ['Feedback loop frame', { kind: 'frame', id: 'feedback-loop' }],
    ['Pip lead guitar outfit', { kind: 'pipOutfit', id: 'lead-guitar' }],
  ],
  'spring-2-2027': [
    ['Blossom sticker', { kind: 'badge', id: 'blossom' }],
    ['Spring rain theme', { kind: 'theme', id: 'spring-rain' }],
    ['Skate stencil frame', { kind: 'frame', id: 'skate-stencil' }],
    ['"Daily Grinder" title', { kind: 'title', text: 'Daily Grinder' }],
    ['Fresh wheels badge', { kind: 'badge', id: 'fresh-wheels' }],
    ['Pip windbreaker outfit', { kind: 'pipOutfit', id: 'windbreaker' }],
    ['Rainbow ramp frame', { kind: 'frame', id: 'rainbow-ramp' }],
    ['Pip street skater outfit', { kind: 'pipOutfit', id: 'street-skater' }],
  ],
  'summer-1-2027': [
    ['Calm cloud sticker', { kind: 'badge', id: 'calm-cloud' }],
    ['Still water theme', { kind: 'theme', id: 'still-water' }],
    ['Steady path frame', { kind: 'frame', id: 'steady-path' }],
    ['"Cool Head" title', { kind: 'title', text: 'Cool Head' }],
    ['Good sleep badge', { kind: 'badge', id: 'good-sleep' }],
    ['Pip zen outfit', { kind: 'pipOutfit', id: 'zen' }],
    ['Sunrise frame', { kind: 'frame', id: 'sunrise' }],
    ['Pip mountain guide outfit', { kind: 'pipOutfit', id: 'mountain-guide' }],
  ],
  'summer-2-2027': [
    ['Festival wristband sticker', { kind: 'badge', id: 'wristband' }],
    ['Golden hour theme', { kind: 'theme', id: 'golden-hour' }],
    ['Bunting frame', { kind: 'frame', id: 'bunting' }],
    ['"Summer Headliner" title', { kind: 'title', text: 'Summer Headliner' }],
    ['Open-air cinema badge', { kind: 'badge', id: 'open-air-cinema' }],
    ['Pip festival outfit', { kind: 'pipOutfit', id: 'festival' }],
    ['Main stage frame', { kind: 'frame', id: 'main-stage' }],
    ['Pip sunset DJ outfit', { kind: 'pipOutfit', id: 'sunset-dj' }],
  ],
};

export const SEASON_REWARDS: readonly Reward[] = SEASONS.flatMap((s) =>
  (DROPS[s.id] ?? []).map(([name, item], i): Reward => ({
    id: `${s.id}-${i + 1}`,
    name,
    rarity: RARITY_BY_TIER[i]!,
    source: 'season',
    target: { kind: 'season', seasonId: s.id, atLeast: THRESHOLDS[s.measure][i]! },
    items: [item],
    giftDays: 0,
  })),
);
