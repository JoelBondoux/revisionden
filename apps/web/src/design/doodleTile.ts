/**
 * J8b: the background doodle tile, a dense hand-drawn sticker sheet (the WhatsApp-wallpaper
 * technique, with our own motifs) rather than a grid.
 *
 * The tile is generated, not drawn by hand, from a fixed seed, so it is identical on every build
 * and can be tested. A few big hero doodles go down first, then as many medium doodles as fit, then
 * tiny fillers in the gaps; each is kept a few pixels clear of its neighbours, measured on a tile
 * that wraps round at the edges. Doodles sit upright or tilted by up to 25 degrees, all in one
 * thin line weight, and anything that crosses an edge is drawn again on the opposite side, so the
 * repeat has no seams.
 *
 * The committed `doodle-scatter.svg` is this module's output: the test checks it, and
 * `UPDATE_DOODLES=1 npx vitest run src/design/doodleTile.test.ts` (in apps/web) rewrites it after
 * a change here.
 */

/** Width and height of the tile, in CSS pixels. */
export const TILE_SIZE = 1080;
/** The fixed seed the committed tile is made from. */
export const DOODLE_SEED = 20261126;
/** Line weight as drawn, in pixels, the same for every doodle. */
export const STROKE = 1.4;
/** Clear space between neighbouring doodles, in pixels. */
export const GAP = 4;
/** Two copies of the same medium doodle are never closer than this (on the wrapped tile). */
export const SAME_MOTIF_GAP = 240;
/** Two copies of the same hero doodle are never closer than this. */
export const SAME_HERO_GAP = 520;

/**
 * Our own line motifs (original art), each drawn round its centre in about a 36px box (fillers in
 * about 8px). Stroke-only, no fill. The first sixteen are the J8 tile's doodles, recentred.
 */
export const MOTIFS: Readonly<Record<string, string>> = {
  // Pip, the fox
  fox: '<g transform="translate(-18 -18)"><path d="M0 11 6 0l7 8h10l7-8 6 11-6 14-12 10L6 25z"/><path d="M10 15l4-2 2 3M26 15l-4-2-2 3M15 25h6l-3 3z"/></g>',
  pencil: '<path d="M-16-4h24v8h-24zM8-4l8 4-8 4M-10-4v8"/>',
  book: '<path d="M-17-12c6-3 12-3 17 1 5-4 11-4 17-1v24c-6-3-12-3-17 1-5-4-11-4-17-1zM0-11v24"/>',
  pi: '<path d="M-13-10c4-2 8-2 12-1h12M-5-10c0 10-2 18-6 22M5-10c-1 9 0 16 4 20 2 2 4 1 5-1"/>',
  root: '<path d="M-19 2l5-3 6 15 9-28h18M5-4l8 12M13-4l-8 12"/>',
  divide: '<path d="M-13 0h26"/><circle cy="-9" r="2"/><circle cy="9" r="2"/>',
  square: '<path d="M-14-6 2 12M2-6l-16 18M6-12c1-3 7-3 7 1 0 3-7 6-7 8h8"/>',
  graph: '<path d="M-17-16v32h34M-11 8l8-9 7 5 11-14"/>',
  bulb: '<path d="M-2 13V9c0-3-8-6-8-14a10 10 0 0 1 20 0c0 8-8 11-8 14v4M-4 17h8M0-16v-1M-13-11l-1-1M13-11l1-1"/>',
  star: '<path d="M0-15l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z"/>',
  trophy:
    '<path d="M-9-15H9v8c0 7-4 12-9 12s-9-5-9-12zM-9-11h-6c0 6 3 9 7 9M9-11h6c0 6-3 9-7 9M0 5v6M-7 16H7v-5H-7z"/>',
  calculator:
    '<path d="M-13-16h26v32h-26zM-9-12H9v7H-9z"/><path d="M-7 1h2M0 1h2M-7 7h2M0 7h2M-7 12h2M0 12h2M7 1v11"/>',
  tube: '<g transform="rotate(-25)"><path d="M-6-16H6M-4-16v26a4 4 0 0 0 8 0v-26M-4 0h8"/><circle cy="7" r="1"/></g>',
  headphones: '<path d="M-14 4v-6a14 14 0 0 1 28 0v6M-16 4h7v11h-7zM9 4h7v11H9z"/>',
  planet: '<circle cy="-1" r="10"/><path d="M-15 4c-6 6 2 7 15 2S19-6 13-8"/>',
  sparkles: '<path d="M-8-14v12M-14-8h12M10 2v10M5 7h10M-10 10l4 4M-6 10l-4 4"/>',
  atom: '<circle r="2.5"/><ellipse rx="17" ry="6"/><ellipse rx="17" ry="6" transform="rotate(60)"/><ellipse rx="17" ry="6" transform="rotate(-60)"/>',
  leaf: '<path d="M-14 14C-14-4-2-14 14-14c0 18-10 28-28 28zM-14 14 5-5M-4 4v-7M2-2h7"/>',
  notes:
    '<path d="M-8 10v-22l18-4v22M-8-6l18-4"/><circle cx="-12" cy="10" r="4"/><circle cx="6" cy="6" r="4"/>',
  flask: '<path d="M-6-16H6M-3-16v10l-11 18a3 3 0 0 0 3 4h22a3 3 0 0 0 3-4L3-6v-10M-9 5H9"/>',
  magnifier: '<circle cx="-4" cy="-4" r="10"/><path d="M3 3l12 12M-9-6a6 6 0 0 1 4-4"/>',
  setsquare: '<path d="M-14 14v-28l28 28zM-8 8V0l8 8z"/>',
  helix: '<path d="M-6-16c12 8 12 24 0 32M6-16c-12 8-12 24 0 32M-3-10h6M-4 0h8M-3 10h6"/>',
  globe:
    '<circle r="14"/><path d="M-14 0h28M0-14c-8 8-8 20 0 28M0-14c8 8 8 20 0 28M-12-7h24M-12 7h24"/>',
  plane: '<path d="M-16-2 16-12 6 14 0 4zM0 4l16-16M0 4v8l4-5"/>',
  moon: '<path d="M4-14a14 14 0 1 0 10 22A11 11 0 1 1 4-14z"/>',
  rocket:
    '<path d="M0-17c6 6 7 15 4 24h-8c-3-9-2-18 4-24zM-4 7l-6 6v-9M4 7l6 6v-9M0 11v5"/><circle cy="-5" r="3"/>',
  compass: '<circle cy="-14" r="2"/><path d="M0-12l-9 26M0-12l9 26M-6 4h12"/>',
  question:
    '<path d="M-15-13h30v18H-2l-8 8v-8h-5zM-3-7c0-4 6-4 6 0 0 3-3 3-3 6"/><circle cy="2" r=".8"/>',
  signs: '<path d="M-14-7h10M-9-12v10M4-7h10M-14 8h10M4 4l10 8M14 4 4 12"/>',
  cloud: '<path d="M-12 8a6 6 0 0 1 0-12 9 9 0 0 1 17-3 6 6 0 0 1 7 15z"/>',
  ruler: '<path d="M-17-5h34V5h-34zM-11-5v4M-5-5v6M1-5v4M7-5v6M13-5v4"/>',
  hexagon: '<path d="M0-15 13-7.5v15L0 15-13 7.5v-15z"/><circle r="7"/>',
  wave: '<path d="M-17 0c4-12 7-12 11 0s7 12 11 0 7-12 11 0"/>',
  tick: '<path d="M-12 0l8 8 16-18"/>',
  cap: '<path d="M-17-4 0-12 17-4 0 4zM-10-1v8c6 4 14 4 20 0v-8M14-3v10"/>',
  magnet: '<path d="M-10-12v10a10 10 0 0 0 20 0v-10h-6v10a4 4 0 0 1-8 0v-10zM-10-6h6M4-6h6"/>',
  paperclip: '<path d="M-4 14V-10a5 5 0 0 1 10 0v20a3 3 0 0 1-6 0V-8"/>',
  protractor:
    '<path d="M-16 8a16 16 0 0 1 32 0zM-8 8a8 8 0 0 1 16 0M0 8v-14M-11-3l3 3M11-3l-3 3"/>',
  pie: '<circle r="13"/><path d="M0 0v-13M0 0l11 7"/>',
  sun: '<circle r="6"/><path d="M0-15v4M0 11v4M-15 0h4M11 0h4M-10.6-10.6l2.8 2.8M7.8 7.8l2.8 2.8M-10.6 10.6l2.8-2.8M7.8-7.8l2.8-2.8"/>',
  // School and study
  backpack: '<path d="M-10-8a10 10 0 0 1 20 0v22h-20zM-6-18h12v6M-10 2h20M-4 2v4h8V2"/>',
  eraser: '<path d="M-16 4l12-12h14l-12 12zM-16 4v6h14l12-12V-8M-2 4v6"/>',
  scissors:
    '<circle cx="-10" cy="10" r="5"/><circle cx="10" cy="10" r="5"/><path d="M-7 6 10-16M7 6-10-16"/>',
  notebook: '<path d="M-12-16h24v32h-24zM-16-10h6M-16-2h6M-16 6h6M-4-8h12M-4-2h12M-4 4h8"/>',
  clipboard: '<path d="M-12-14h24v30h-24zM-6-18h12v6H-6zM-6-4h12M-6 2h12M-6 8h8"/>',
  chalkboard: '<path d="M-17-12h34v22h-34zM-8 10l-4 8M8 10l4 8M-11-6l5 6M-11 0l5-6M2-4h8"/>',
  abacus:
    '<path d="M-16-14h32v28h-32zM-16-7h32M-16 0h32M-16 7h32"/><circle cx="-9" cy="-7" r="2.2"/><circle cx="-4" cy="-7" r="2.2"/><circle cx="6" cy="0" r="2.2"/><circle cx="-8" cy="7" r="2.2"/><circle cx="2" cy="7" r="2.2"/><circle cx="8" cy="7" r="2.2"/>',
  pen: '<path d="M-3-18h6v24l-3 10-3-10zM-3 0h6M0 6v4"/>',
  sharpener: '<path d="M-12-8h20v16h-20zM8-4l6-2v10l-6-2"/><circle cx="-2" r="3"/>',
  glue: '<path d="M-6-6h12v22H-6zM-5-6v-6h10v6M-4-12c0-4 8-4 8 0"/>',
  bookmark:
    '<path d="M-12-16h20a4 4 0 0 1 4 4v28h-20a4 4 0 0 1-4-4zM-12 12a4 4 0 0 1 4-4h20M2-16v12l3-3 3 3v-12"/>',
  letters: '<path d="M-15 10l6-20 6 20M-13 4h8M3-10h6a4 4 0 0 1 0 8H3zM3-2h7a4 4 0 0 1 0 8H3z"/>',
  percent: '<circle cx="-8" cy="-8" r="4"/><circle cx="8" cy="8" r="4"/><path d="M10-12-10 12"/>',
  infinity: '<path d="M0 0c-4-6-14-6-14 0s10 6 14 0 14-6 14 0-10 6-14 0z"/>',
  angle: '<path d="M-15 13h30L0-14zM-9 13a6 6 0 0 0-2-5"/>',
  cube: '<path d="M-10-6 2-12l10 6v14L2 14l-12-6zM-10-6 2 0l10-6M2 0v14"/>',
  cylinder: '<ellipse cy="-10" rx="10" ry="4"/><path d="M-10-10v20c0 5 20 5 20 0v-20"/>',
  venn: '<circle cx="-5" r="10"/><circle cx="5" r="10"/>',
  bars: '<path d="M-15 15h30M-11 15V3h6v12M-3 15V-7h6v22M5 15V-1h6v16"/>',
  parabola: '<path d="M-16 8h32M-8-16v30M-14-12c4 22 12 22 16 0"/>',
  dice: '<path d="M-12-12h24v24h-24z"/><circle cx="-6" cy="-6" r="1.6"/><circle r="1.6"/><circle cx="6" cy="6" r="1.6"/>',
  microscope: '<path d="M-12 16h24M-2 16v-4M-8 12h14M2-16l6 2-8 22-6-2zM5 0a8 8 0 0 1-2 12"/>',
  beaker: '<path d="M-10-14h20M-8-14v26h16v-26M-8 0h16M-4 6h2"/>',
  burner: '<path d="M-4 16V-2h8v18M-10 16h20M0-6c-4-4 0-8 0-12 4 4 6 8 0 12z"/>',
  molecule:
    '<circle cx="-10" cy="6" r="4"/><circle cx="8" cy="-8" r="5"/><circle cx="10" cy="10" r="3"/><path d="M-7 4 4-5M9-3l1 10"/>',
  bone: '<path d="M-8-3 8 3M-11-5a3 3 0 1 1 1-5 3 3 0 1 1 4 3M11 5a3 3 0 1 1-1 5 3 3 0 1 1-4-3"/>',
  heart: '<path d="M0 14S-14 5-14-4a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 9-14 18-14 18z"/>',
  eye: '<path d="M-16 0s6-10 16-10S16 0 16 0 10 10 0 10-16 0-16 0z"/><circle r="4"/>',
  map: '<path d="M-16-12l10-4 12 4 10-4v28l-10 4-12-4-10 4zM-6-16v28M6-12v28"/>',
  rose: '<circle r="14"/><path d="M0-10l3 10-3 10-3-10zM-10 0h4M6 0h4"/>',
  mountain: '<path d="M-17 14-4-8l8 12 4-6 9 16zM-8-2l4 3 3-2"/>',
  volcano:
    '<path d="M-16 14l9-18h14l9 18zM-7-4c2 3 4-2 7 1s5-2 7 1M-2-8c-2-4 2-6 0-10M4-8c2-3 0-6 2-9"/>',
  castle: '<path d="M-14 16v-20h6v4h4v-4h8v4h4v-4h6v20zM-4 16v-8a4 4 0 0 1 8 0v8"/>',
  pyramid: '<path d="M-17 14 0-14l17 28zM0-14l4 28M-8 0h12"/>',
  shield: '<path d="M-12-14h24v10c0 12-12 18-12 18s-12-6-12-18zM0-14v32M-12-4h24"/>',
  quill: '<path d="M12-16C-4-12-10 0-10 16M12-16c-2 10-10 18-20 22M-4 2h6"/>',
  language: '<path d="M-16 10l7-20 7 20M-14 4h10M15-1v11"/><circle cx="9" cy="5" r="5"/>',
  flag: '<path d="M-12 18v-34M-12-16h22l-5 7 5 7h-22"/>',
  palette:
    '<path d="M0-15c-9 0-16 6-16 14s7 15 14 15c4 0 4-4 2-6s0-6 4-6h6c4 0 6-3 6-6 0-6-7-11-16-11z"/><circle cx="-7" cy="-4" r="2"/><circle cy="-8" r="2"/><circle cx="7" cy="-5" r="2"/>',
  brush: '<path d="M10-16-4 6M-4 6c-4 0-8 3-8 10 5 0 9-2 10-6zM6-12l4 4"/>',
  masks:
    '<path d="M-14-12h12v8a6 6 0 0 1-12 0zM-11-6h2M-7-6h2M-11 0c2 2 4 2 6 0M2-6h12v8a6 6 0 0 1-12 0zM5 0h2M9 0h2M5 7c2-2 4-2 6 0"/>',
  camera: '<path d="M-16-8h8l3-5h10l3 5h8v20h-32z"/><circle cy="2" r="6"/>',
  // Space
  comet: '<circle cx="8" cy="-8" r="5"/><path d="M4-4-14 14M6-2-8 14M2-6-14 8"/>',
  satellite:
    '<path d="M-4-4h8v8h-8zM-4 0h-6M4 0h6M-16-6h6v12h-6zM10-6h6v12h-6zM0 4v6M-3 13a4 4 0 0 1 6 0"/>',
  telescope: '<path d="M-12 2 10-8l3 6-22 10zM-4 6l-6 12M-4 6l4 12M10-8l3-2 3 6-3 2"/>',
  helmet: '<circle r="13"/><path d="M-8-4h16v6a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4zM-13 6h-3M13 6h3"/>',
  shootingStar:
    '<path d="M8-12l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1zM2-2-14 14M-2-6-12 4M4 2-6 12"/>',
  constellation:
    '<circle cx="-12" cy="-8" r="1.5"/><circle cx="-2" cy="-12" r="1.5"/><circle cx="6" cy="-2" r="1.5"/><circle cx="14" cy="8" r="1.5"/><circle cx="-6" cy="10" r="1.5"/><path d="M-12-8l10-4 8 10 8 10M6-2-6 10"/>',
  // Nature
  tree: '<path d="M0 16V2M-6 8l6-6 6 6M0-16c-8 0-12 6-10 12 2 4 8 6 10 6s8-2 10-6c2-6-2-12-10-12z"/>',
  flower:
    '<circle cy="-4" r="3.5"/><path d="M0 0v16M0 10c-6 0-8-4-8-6 4 0 7 2 8 6M-4-4h-6M4-4h6M0-8v-6M-3-7l-4-4M3-7l4-4M-3-1l-4 4M3-1l4 4"/>',
  mushroom:
    '<path d="M-14 0a14 12 0 0 1 28 0zM-5 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V0"/><circle cx="-6" cy="-6" r="2"/><circle cx="4" cy="-8" r="2"/>',
  cactus:
    '<path d="M-4 16v-28a4 4 0 0 1 8 0v28M-4 4h-4a4 4 0 0 1-4-4v-6M4-2h4a4 4 0 0 0 4-4v-4M-10 16h20"/>',
  snail:
    '<circle cx="2" r="9"/><path d="M2 0a4 4 0 1 1 4-3M-16 10h28M-14 10c-2-4 0-10 2-12M-12-2l-2-6M-10-2l2-6"/>',
  butterfly:
    '<path d="M0-10v22M0 0c-8-12-16-8-14 0 2 6 10 4 14 0zM0 0c8-12 16-8 14 0-2 6-10 4-14 0zM0 2c-6 4-10 10-6 12 3 1 6-6 6-8zM0 2c6 4 10 10 6 12-3 1-6-6-6-8zM-2-12l-3-4M2-12l3-4"/>',
  bee: '<ellipse cy="2" rx="10" ry="7"/><path d="M-3-5v14M3-5v14M-6-6c-6-8-12-2-6 2M6-6c6-8 12-2 6 2M10 2h4"/>',
  fish: '<path d="M-14 0C-8-10 4-10 8 0 4 10-8 10-14 0zM8 0l8-6v12z"/><circle cx="-6" cy="-2" r="1.5"/>',
  bird: '<path d="M-14 4c6 0 10-4 12-10 2 6 6 8 12 6-2 6-8 10-16 8M8-8h6l-4 4"/>',
  paw: '<circle cy="6" r="6"/><circle cx="-9" cy="-4" r="3"/><circle cx="-3" cy="-11" r="3"/><circle cx="4" cy="-11" r="3"/><circle cx="10" cy="-4" r="3"/>',
  raindrop: '<path d="M0-16C6-6 10 0 10 6a10 10 0 0 1-20 0c0-6 4-12 10-22z"/>',
  snowflake: '<path d="M0-16v32M-14-8l28 16M-14 8l28-16M-3-13l3 3 3-3M-3 13l3-3 3 3"/>',
  rainbow: '<path d="M-16 10a16 16 0 0 1 32 0M-11 10a11 11 0 0 1 22 0M-6 10a6 6 0 0 1 12 0"/>',
  lightning: '<path d="M4-16-8 2h8l-4 14 12-18H0l4-14z"/>',
  acorn:
    '<path d="M-10-4h20c0-6-4-10-10-10S-10-10-10-4zM0-14v-4M-8-4c0 10 4 16 8 18 4-2 8-8 8-18"/>',
  // Music
  guitar:
    '<path d="M10-16l4 4M12-14-2 0M-2 0c4 4 2 10-4 12-6 2-10-2-8-8 2-6 8-8 12-4z"/><circle cx="-5" cy="6" r="2"/>',
  drum: '<ellipse cy="-6" rx="13" ry="5"/><path d="M-13-6v14c0 6 26 6 26 0V-6M-13 4l6-5 6 5 6-5 6 5M-10-16l8 8M10-16 2-8"/>',
  note: '<ellipse cx="-1" cy="11" rx="5" ry="4"/><path d="M4 11v-25c4 2 8 4 8 10"/>',
  microphone: '<path d="M-6-16h12V0A6 6 0 0 1-6 0zM-10 0a10 10 0 0 0 20 0M0 10v6M-6 16h12"/>',
  piano:
    '<path d="M-16-10h32v20h-32zM-8 0v10M0 0v10M8 0v10M-10-10V0h4v-10M-2-10V0h4v-10M6-10V0h4v-10"/>',
  trumpet: '<path d="M-16-2H4l10-8v20L4 2h-20zM-8-2v-4M-2-2v-4M4 2v6"/>',
  speaker:
    '<path d="M-14-10h28v22h-28zM-14-4h28"/><circle cx="-4" cy="5" r="4"/><circle cx="8" cy="2" r="1.5"/>',
  // Sport
  football:
    '<circle r="14"/><path d="M0-6l6 4-2 7h-8l-2-7zM0-6v-8M6-2l7-3M4 5l5 6M-4 5l-5 6M-6-2l-7-3"/>',
  basketball:
    '<circle r="14"/><path d="M-14 0h28M0-14v28M-10-10c6 6 6 14 0 20M10-10c-6 6-6 14 0 20"/>',
  racket:
    '<ellipse cx="-3" cy="-5" rx="9" ry="11" transform="rotate(-30 -3 -5)"/><path d="M3 5l10 12M-10-8l12 4M-6-14l8 16"/>',
  medal:
    '<path d="M-8-16 0-4l8-12M-4-16h8M0 1l1.6 3.3 3.6.4-2.7 2.4.8 3.5L0 9l-3.3 1.6.8-3.5-2.7-2.4 3.6-.4z"/><circle cy="6" r="9"/>',
  whistle: '<path d="M-14-4H4a8 8 0 1 1-8 8h-10zM4-4l6-6h6M-6 0h2"/>',
  trainer: '<path d="M-16 8V-6h8c2 4 6 6 12 6 6 0 12 2 12 8zM-16 8v4h32V8M-6-2l2 2M-2-1l2 2"/>',
  bike: '<circle cx="-9" cy="6" r="7"/><circle cx="9" cy="6" r="7"/><path d="M-9 6l6-12h8l4 12M-3-6l3 12 5-12M-6-8h6"/>',
  kite: '<path d="M0-16 10-2 0 10l-10-12zM-10-2h20M0-16v26M0 10c-2 4 2 6 0 8"/>',
  dumbbell: '<path d="M-12 0h24M-16-6v12M-12-8v16M12-8v16M16-6v12"/>',
  // Food
  apple:
    '<path d="M0-8c-4-4-12-2-12 6s6 14 12 12c6 2 12-4 12-12S4-12 0-8zM0-8c0-4 2-6 4-8M2-12c4-2 6 0 6 2-3 1-5 0-6-2"/>',
  pizza:
    '<path d="M-14-12h28L0 16zM-14-12c4-4 24-4 28 0"/><circle cx="-4" cy="-6" r="2"/><circle cx="4" cy="-4" r="2"/><circle cy="4" r="1.5"/>',
  cupcake:
    '<path d="M-10 0h20l-3 16H-7zM-12 0c0-8 4-12 12-12S12-8 12 0M-4 0l-1 16M4 0l1 16M0-12v-4"/>',
  carrot: '<path d="M-12 14 8-10a5 5 0 0 0-7-7zM8-10l6-6M6-12l2-6M10-8l6-2M-6 4l2 2M-2 0l2 2"/>',
  sandwich: '<path d="M-16 2 0-12 16 2zM-16 2v6h32V2M-16 8c4 3 8-3 12 0s8-3 12 0 8-3 8 0"/>',
  banana: '<path d="M-14 6c8 8 22 4 28-12-6 6-18 10-28 6zM14-6l2-4"/>',
  iceCream: '<path d="M-8-2 0 16l8-18M-9-2a9 9 0 0 1 18 0zM-4-10a4 4 0 1 1 8 0"/>',
  mug: '<path d="M-12-10H6v22h-18zM6-6h4a4 4 0 0 1 0 8H6M-8-16c0-3 3-3 3-6M-2-16c0-3 3-3 3-6"/>',
  cherries:
    '<circle cx="-7" cy="9" r="5"/><circle cx="7" cy="7" r="5"/><path d="M-7 4c0-8 4-14 10-18M7 2C6-6 4-12 3-14M3-14c4-2 8-1 10 2-4 2-8 1-10-2"/>',
  // Tech
  laptop: '<path d="M-12-12h24V6h-24zM-16 6h32l-2 6h-28z"/>',
  phone: '<path d="M-8-16H8v32H-8zM-8-10H8M-8 10H8M-2 13h4"/>',
  gamepad:
    '<path d="M-10-6h20a8 8 0 0 1 6 12l-2 4a4 4 0 0 1-6 0l-3-3h-10l-3 3a4 4 0 0 1-6 0l-2-4a8 8 0 0 1 6-12zM-10-1v6M-13 2h6"/><circle cx="8" r="1.5"/><circle cx="11" cy="3" r="1.5"/>',
  robot:
    '<path d="M-10-8h20V8h-20zM0-8v-5M-5 4h10M-14-2v6M14-2v6"/><circle cy="-14" r="1.5"/><circle cx="-4" cy="-1" r="2"/><circle cx="4" cy="-1" r="2"/>',
  wifi: '<path d="M-16-4a22 22 0 0 1 32 0M-10 2a14 14 0 0 1 20 0M-5 8a6 6 0 0 1 10 0"/><circle cy="13" r="1.5"/>',
  battery: '<path d="M-14-7h26V7h-26zM12-3h4v6M-10-3v6M-6-3v6M-2-3v6"/>',
  mouse: '<path d="M-8-6a8 8 0 0 1 16 0V4A8 8 0 0 1-8 4zM0-14v8M-8-2H8"/>',
  gear: '<circle r="5"/><path d="M-2-14h4l1 4 4 2 4-2 3 3-2 4 2 4 4 1v4l-4 1-2 4 2 4-3 3-4-2-4 2-1 4h-4l-1-4-4-2-4 2-3-3 2-4-2-4-4-1v-4l4-1 2-4-2-4 3-3 4 2 4-2z"/>',
  code: '<path d="M-8-10-16 0l8 10M8-10l8 10-8 10M4-14-4 14"/>',
  save: '<path d="M-14-14H8l6 6v22h-28zM-8-14v8H4v-8M-8 14V4H8v10"/>',
  // Everyday things
  umbrella: '<path d="M-16 0a16 16 0 0 1 32 0zM0 0v12a3 3 0 0 1-6 0M0-16v-2"/>',
  key: '<circle cx="-8" r="6"/><path d="M-2 0h18M10 0v5M14 0v4"/>',
  clock: '<circle r="14"/><path d="M0-8V0l6 4"/>',
  hourglass:
    '<path d="M-9-16H9M-9 16H9M-7-16c0 10 14 10 14 16S-7 6-7 16M7-16c0 10-14 10-14 16S7 6 7 16"/>',
  envelope: '<path d="M-16-10h32v22h-32zM-16-10 0 4l16-14"/>',
  present:
    '<path d="M-12-2h24v16h-24zM-14-8h28v6h-28zM0-8v22M0-8c-4-6-10-6-8-1 1 2 6 1 8 1zM0-8c4-6 10-6 8-1-1 2-6 1-8 1z"/>',
  balloon:
    '<path d="M0-16c-8 0-11 6-11 11 0 7 6 12 11 13 5-1 11-6 11-13 0-5-3-11-11-11zM0 8l-2 3h4zM0 11c-3 3 3 4 0 7"/>',
  glasses:
    '<circle cx="-8" cy="2" r="6"/><circle cx="8" cy="2" r="6"/><path d="M-2 2h4M-14 2l-3-6M14 2l3-6"/>',
  house: '<path d="M-14 2 0-12 14 2M-10-2v16h20V-2M-3 14V6h6v8"/>',
  tent: '<path d="M-16 14 0-14l16 28zM0-14v28M-5 14l5-10 5 10"/>',
  anchor:
    '<circle cy="-12" r="3"/><path d="M0-9v24M-6-4H6M-12 6c0 6 6 9 12 9s12-3 12-9M-14 8l2-3 3 2M14 8l-2-3-3 2"/>',
  pushpin: '<path d="M-6-14H6M-4-14v10l-6 6h20l-6-6v-10M0 2v14"/>',
  puzzle:
    '<path d="M-12-12h8a4 4 0 1 1 8 0h8v8a4 4 0 1 1 0 8v8H4a4 4 0 1 0-8 0h-8V4a4 4 0 1 0 0-8z"/>',
  smiley:
    '<circle r="14"/><path d="M-6 4c3 4 9 4 12 0"/><circle cx="-5" cy="-4" r="1.5"/><circle cx="5" cy="-4" r="1.5"/>',
  crown: '<path d="M-14 8-16-8l9 6 7-12 7 12 9-6-2 16zM-14 12h28"/>',
  target: '<circle r="14"/><circle r="8"/><circle r="2"/>',
  boat: '<path d="M-16 4h32l-6 10h-20zM-2 4v-20L10 4"/>',
  car: '<path d="M-16 6V0l4-8h18l6 8h4v6zM-12 6a3 3 0 1 0 6 0M6 6a3 3 0 1 0 6 0M-8-8l-2 8M2-8v8"/>',
  hotAirBalloon:
    '<path d="M0-16c-9 0-13 6-13 11 0 6 7 11 9 13h8c2-2 9-7 9-13 0-5-4-11-13-11zM-4 8v6h8V8M-4-15c-3 6-3 14 0 23M4-15c3 6 3 14 0 23"/>',
  bell: '<path d="M-11 8c2-2 3-6 3-12a8 8 0 0 1 16 0c0 6 1 10 3 12zM-2 12a2 2 0 0 0 4 0M0-12v-3"/>',
  calendar: '<path d="M-14-12h28v26h-28zM-14-4h28M-8-16v6M8-16v6M-8 2h4M2 2h4M-8 8h4"/>',
  // Hero doodles: drawn in the same ~36px box with more detail, shown about three times larger.
  foxReading:
    '<g transform="translate(-11 -19) scale(.62)"><path d="M0 11 6 0l7 8h10l7-8 6 11-6 14-12 10L6 25z"/><path d="M10 15l4-2 2 3M26 15l-4-2-2 3M15 25h6l-3 3z"/></g><path d="M-17 4c6-3 12-3 17 1 5-4 11-4 17-1v13c-6-3-12-3-17 1-5-4-11-4-17-1zM0 5v13M-13 8h8M-13 11h7M-13 14h8M5 8h8M6 11h7M5 14h8"/>',
  bookStack:
    '<path d="M-15 8h30v8h-30zM-12 0h26v8h-26zM-16-8h28v8h-28zM-10 8v8M9 0v8M-12-8v8M-6 12h16M-6 4h14M-8-4h16"/><path d="M2-11c-4-4-9 0-6 4 2 3 4 3 6 2 2 1 4 1 6-2 3-4-2-8-6-4zM2-11c0-2 1-4 3-5"/>',
  labBench:
    '<path d="M-12-16h8M-10-16v8l-8 16a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-8-16v-8M-16 4h14M8-14h8M10-14v24a2 2 0 0 0 4 0v-24M10 0h4M-19 18h38"/><circle cx="-6" cy="-12" r="1"/><circle cx="-4" cy="0" r="1.5"/><circle cx="-9" cy="-3" r="1"/>',
  rocketTrip:
    '<path d="M2-18c6 6 7 15 4 24h-8c-3-9-2-18 4-24zM-2 6l-6 6v-9M6 6l6 6v-9M2 10v6M-2 14l-2 4M6 14l2 4"/><circle cx="2" cy="-6" r="3"/><path d="M-16-12h0M-12 2h0M14-14h0M16 0h0M-15-4l2 2M12 10l2 2"/>',
  globeStand:
    '<circle cy="-4" r="13"/><path d="M-13-4h26M0-17c-7 7-7 19 0 26M0-17c7 7 7 19 0 26M-11-11h22M-11 3h22M-16-4a16 16 0 0 0 26 12M0 12v5M-8 18h16"/>',
  bigCalculator:
    '<path d="M-13-17h26v34h-26zM-9-13H9v8H-9zM-7-8h4"/><path d="M-7 0h2M-1 0h2M5 0h2M-7 5h2M-1 5h2M5 5h2M-7 10h2M-1 10h2M5 10v4M-7 14h8"/>',
  ringedPlanet:
    '<circle r="11"/><path d="M-19 5c-5 6 4 7 19 1s23-14 18-18c-2-2-7-1-12 1M-5-6a6 6 0 0 1 6-3"/><circle cx="16" cy="-14" r="2"/><path d="M-16-14v4M-18-12h4"/>',
  trophyCup:
    '<path d="M-9-16H9v9c0 7-4 12-9 12s-9-5-9-12zM-9-12h-6c0 6 3 10 7 10M9-12h6c0 6-3 10-7 10M0 5v6M-8 17H8v-6H-8zM-3-10l3-3 3 3M0-13v9"/>',
  // Fillers: tiny shapes that plug the gaps, drawn in about an 8px box.
  dot: '<circle r=".8"/>',
  ring: '<circle r="2.6"/>',
  sparkle: '<path d="M0-4.5C0-1 1 0 4.5 0 1 0 0 1 0 4.5 0 1-1 0-4.5 0-1 0 0-1 0-4.5z"/>',
  plus: '<path d="M0-3v6M-3 0h6"/>',
  tinyStar: '<path d="M0-4l1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 2.2-2.5 3.6l.6-2.8L-4-1.1l2.8-.3z"/>',
  dash: '<path d="M-3 0h6"/>',
  triangle: '<path d="M0-3 3 2.5h-6z"/>',
};

/** Motifs used as big hero doodles. */
export const HEROES: readonly string[] = [
  'foxReading',
  'bookStack',
  'labBench',
  'rocketTrip',
  'globeStand',
  'bigCalculator',
  'ringedPlanet',
  'trophyCup',
];
/** Motifs used as tiny fillers. */
export const FILLERS: readonly string[] = [
  'dot',
  'ring',
  'sparkle',
  'plus',
  'tinyStar',
  'dash',
  'triangle',
];
/** Everything else is a medium doodle. */
const MEDIUMS = Object.keys(MOTIFS).filter((m) => !HEROES.includes(m) && !FILLERS.includes(m));

/** One doodle on the tile: which motif, its size tier, where its centre is, and how it is turned. */
export interface Placement {
  readonly motif: string;
  readonly tier: 'hero' | 'medium' | 'filler';
  readonly x: number;
  readonly y: number;
  /** Degrees: -25 to 25 for heroes and medium doodles, any angle for fillers. */
  readonly rotate: number;
  /** Times the motif's own size. */
  readonly scale: number;
}

/** How far a doodle's drawing reaches from its centre (the circle kept clear of others). */
export function radius(p: Pick<Placement, 'tier' | 'scale'>): number {
  return (p.tier === 'filler' ? 4.5 : 18) * p.scale;
}

/** How far past an edge a doodle can poke out (corners included), so it is drawn again there. */
export function reach(p: Pick<Placement, 'tier' | 'scale'>): number {
  return radius(p) * 1.4 + STROKE;
}

/** A small seeded random number generator (mulberry32): numbers from 0 up to 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Shuffles a copy of a list with the given randomness (Fisher–Yates). */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface Tier {
  readonly tier: Placement['tier'];
  readonly motifs: readonly string[];
  readonly scale: readonly [number, number];
  readonly tilt: number;
  /** Extra space kept round this tier, on top of GAP (spreads the heroes out). */
  readonly spread: number;
  /** Stop after this many misses in a row (or at `max` doodles). */
  readonly misses: number;
  readonly max: number;
  /** Two copies of one motif are never closer than this (0: no rule, for the tiny fillers). */
  readonly same: number;
}

const TIERS: readonly Tier[] = [
  {
    tier: 'hero',
    motifs: HEROES,
    scale: [2.9, 3.4],
    tilt: 18,
    spread: 160,
    misses: 4000,
    max: 8,
    same: SAME_HERO_GAP,
  },
  {
    tier: 'medium',
    motifs: MEDIUMS,
    scale: [0.95, 1.35],
    tilt: 25,
    spread: 0,
    misses: 6000,
    max: 2000,
    same: SAME_MOTIF_GAP,
  },
  {
    tier: 'filler',
    motifs: FILLERS,
    scale: [0.8, 1.2],
    tilt: 180,
    spread: 0,
    misses: 8000,
    max: 4000,
    same: 0,
  },
];

/** Packs the doodles for a seed: heroes, then medium doodles, then fillers, every one kept clear. */
export function placeDoodles(seed: number = DOODLE_SEED): Placement[] {
  const random = seededRandom(seed);
  const placed: Placement[] = [];
  const cell = 64;
  const cells = Math.floor(TILE_SIZE / cell);
  const cellSize = TILE_SIZE / cells;
  const grid: Placement[][] = Array.from({ length: cells * cells }, () => []);
  const heroes: Placement[] = [];
  const cellOf = (v: number) => Math.min(cells - 1, Math.floor(v / cellSize));
  const clear = (c: Placement, spread: number) => {
    const fits = (p: Placement) => {
      const dx = Math.min(Math.abs(p.x - c.x), TILE_SIZE - Math.abs(p.x - c.x));
      const dy = Math.min(Math.abs(p.y - c.y), TILE_SIZE - Math.abs(p.y - c.y));
      const need =
        radius(p) + radius(c) + GAP + (p.tier === 'hero' && c.tier === 'hero' ? spread : 0);
      return Math.hypot(dx, dy) >= need;
    };
    if (!heroes.every(fits)) return false;
    const cx = cellOf(c.x);
    const cy = cellOf(c.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid[((cy + dy + cells) % cells) * cells + ((cx + dx + cells) % cells)]!;
        if (!bucket.every(fits)) return false;
      }
    }
    return true;
  };

  const copies = new Map<string, Placement[]>();
  const far = (motif: string, x: number, y: number, gap: number) =>
    (copies.get(motif) ?? []).every((p) => {
      const dx = Math.min(Math.abs(p.x - x), TILE_SIZE - Math.abs(p.x - x));
      const dy = Math.min(Math.abs(p.y - y), TILE_SIZE - Math.abs(p.y - y));
      return Math.hypot(dx, dy) >= gap;
    });

  for (const t of TIERS) {
    let misses = 0;
    let count = 0;
    while (misses < t.misses && count < t.max) {
      const [lo, hi] = t.scale;
      const spot: Placement = {
        motif: '',
        tier: t.tier,
        x: round(random() * TILE_SIZE, 1) % TILE_SIZE,
        y: round(random() * TILE_SIZE, 1) % TILE_SIZE,
        rotate: round((random() * 2 - 1) * t.tilt, 1),
        scale: round(lo + random() * (hi - lo), 2),
      };
      if (!clear(spot, t.spread)) {
        misses++;
        continue;
      }
      // The least-used motif (ties broken at random) with no copy of itself nearby.
      const used = (m: string) => copies.get(m)?.length ?? 0;
      const order = shuffled(t.motifs, random).sort((a, b) => used(a) - used(b));
      const motif = order.find((m) => t.same === 0 || far(m, spot.x, spot.y, t.same));
      if (!motif) {
        misses++;
        continue;
      }
      const c = { ...spot, motif };
      misses = 0;
      count++;
      placed.push(c);
      copies.set(motif, [...(copies.get(motif) ?? []), c]);
      if (c.tier === 'hero') heroes.push(c);
      else grid[cellOf(c.y) * cells + cellOf(c.x)]!.push(c);
    }
  }
  return placed;
}

/** The tile as SVG markup: motifs defined once, each doodle (and its edge copies) a `<use>`. */
export function renderDoodleTile(placements: readonly Placement[]): string {
  const used = Object.keys(MOTIFS).filter((name) => placements.some((p) => p.motif === name));
  const defs = used.map((name) => `<g id="${name}">${MOTIFS[name]}</g>`).join('\n');
  const uses: string[] = [];
  for (const p of placements) {
    const r = reach(p);
    const xs = [p.x];
    const ys = [p.y];
    if (p.x < r) xs.push(round(p.x + TILE_SIZE, 1));
    if (p.x > TILE_SIZE - r) xs.push(round(p.x - TILE_SIZE, 1));
    if (p.y < r) ys.push(round(p.y + TILE_SIZE, 1));
    if (p.y > TILE_SIZE - r) ys.push(round(p.y - TILE_SIZE, 1));
    const width = round(STROKE / p.scale, 2);
    for (const y of ys) {
      for (const x of xs) {
        uses.push(
          `<use href="#${p.motif}" transform="translate(${x} ${y}) rotate(${p.rotate}) scale(${p.scale})" stroke-width="${width}"/>`,
        );
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">`,
    '<!-- RevisionDen doodle tile (J8b): original line drawings packed like a sticker sheet, from a',
    '     fixed seed. Generated by apps/web/src/design/doodleTile.ts; do not edit by hand. Used as a',
    '     CSS mask; colour comes from the theme. -->',
    `<defs>\n${defs}\n</defs>`,
    ...uses,
    '</svg>',
    '',
  ].join('\n');
}
