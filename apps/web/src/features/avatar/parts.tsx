/**
 * Original avatar art, drawn as simple angular shapes in a 120 × 120 box (the same geometric
 * style as Pip). Items are inspired by hobbies and games but copy no real character or logo.
 * Colour layers (skin, hair colour, top colour, background colour) are colour maps; every other
 * layer has one small drawing per item.
 */
import type { ReactNode } from 'react';
import type { AvatarLayer } from '@revisionden/core';

const INK = '#2B2B3A';
const WHITE = '#FFFFFF';
const GOLD = '#FFC83D';
const GOLD_EDGE = '#C99400';

export const SKIN: Record<string, string> = {
  'skin-1': '#FDE0C8',
  'skin-2': '#F6C9A0',
  'skin-3': '#E8AE7E',
  'skin-4': '#D29567',
  'skin-5': '#B87A4B',
  'skin-6': '#965F36',
  'skin-7': '#73452A',
  'skin-8': '#52301D',
  alien: '#7ED957',
  robot: '#AEB8C6',
};

export const HAIR: Record<string, string> = {
  black: '#1F1B1A',
  'dark-brown': '#3B2416',
  brown: '#6B4226',
  auburn: '#8E3B1E',
  ginger: '#C8612A',
  blonde: '#E8C46A',
  grey: '#9C9CA6',
  white: '#EDEDED',
  blue: '#2F6FDE',
  purple: '#7B3FD1',
  teal: '#14928C',
  red: '#C62828',
  'neon-green': '#39FF14',
  'hot-pink': '#FF2EA6',
};

export const TOP_COLOUR: Record<string, string> = {
  white: '#FFFFFF',
  black: '#2B2B3A',
  navy: '#1F2A5C',
  red: '#D63A3A',
  orange: '#FF7A2F',
  yellow: '#FFC83D',
  green: '#0B8457',
  teal: '#14928C',
  blue: '#2F6FDE',
  purple: '#6C47F5',
  pink: '#F062A8',
  grey: '#8A8A99',
};

export const BACKGROUND: Record<string, string> = {
  sky: '#BFE3FF',
  mint: '#C8F2DC',
  sand: '#F5E3B8',
  lilac: '#E2D8FF',
  peach: '#FFD9C2',
  slate: '#C9D1DB',
  red: '#FFB3B3',
  orange: '#FFCC99',
  yellow: '#FFF0A3',
  green: '#B9E6A1',
  blue: '#A9C8FF',
  pink: '#FFC2E0',
};

export interface Paint {
  skin: string;
  hair: string;
  top: string;
}

type Draw = (p: Paint) => ReactNode;
const nothing: Draw = () => null;

export const HEAD_POINTS = '40,38 48,28 72,28 80,38 80,62 70,74 50,74 40,62';
const BODY = 'M22 120 L28 94 L46 84 H74 L92 94 L98 120 Z';

const pair = (draw: (x: number) => ReactNode) => (
  <>
    {draw(51)}
    {draw(69)}
  </>
);

const EYES: Record<string, Draw> = {
  'eyes-round': () => pair((x) => <circle cx={x} cy={50} r={3} fill={INK} />),
  'eyes-happy': () =>
    pair((x) => (
      <path d={`M${x - 4} 51 Q${x} 45 ${x + 4} 51`} stroke={INK} strokeWidth={2.5} fill="none" />
    )),
  'eyes-sleepy': () =>
    pair((x) => (
      <>
        <path d={`M${x - 4} 50 H${x + 4}`} stroke={INK} strokeWidth={2.5} />
        <path d={`M${x - 3} 50 Q${x} 54 ${x + 3} 50`} fill={INK} />
      </>
    )),
  'eyes-wink': () => (
    <>
      <circle cx={51} cy={50} r={3} fill={INK} />
      <path d="M65 51 Q69 46 73 51" stroke={INK} strokeWidth={2.5} fill="none" />
    </>
  ),
  'eyes-wide': () =>
    pair((x) => (
      <>
        <circle cx={x} cy={50} r={4.5} fill={WHITE} stroke={INK} strokeWidth={1} />
        <circle cx={x} cy={50} r={2.5} fill={INK} />
      </>
    )),
  'eyes-starry': () =>
    pair((x) => (
      <polygon
        points={`${x},45 ${x + 1.5},48.5 ${x + 5},49 ${x + 2.3},51.3 ${x + 3},55 ${x},53 ${x - 3},55 ${x - 2.3},51.3 ${x - 5},49 ${x - 1.5},48.5`}
        fill={GOLD}
        stroke={INK}
        strokeWidth={0.8}
      />
    )),
  'eyes-focused': () =>
    pair((x) => (
      <>
        <path
          d={`M${x - 4} ${x < 60 ? 44 : 46} L${x + 4} ${x < 60 ? 46 : 44}`}
          stroke={INK}
          strokeWidth={2}
        />
        <circle cx={x} cy={50} r={2.5} fill={INK} />
      </>
    )),
  'eyes-lashes': () =>
    pair((x) => (
      <>
        <circle cx={x} cy={50} r={3} fill={INK} />
        <path
          d={`M${x - 3} 46 l-2 -2 M${x} 45.5 v-2.5 M${x + 3} 46 l2 -2`}
          stroke={INK}
          strokeWidth={1.2}
        />
      </>
    )),
  'eyes-side': () =>
    pair((x) => (
      <>
        <ellipse cx={x} cy={50} rx={4.5} ry={3.5} fill={WHITE} stroke={INK} strokeWidth={1} />
        <circle cx={x + 2} cy={50} r={2} fill={INK} />
      </>
    )),
  'eyes-sparkle': () =>
    pair((x) => (
      <>
        <circle cx={x} cy={50} r={3.5} fill={INK} />
        <circle cx={x + 1.2} cy={48.8} r={1.2} fill={WHITE} />
      </>
    )),
};

const MOUTHS: Record<string, Draw> = {
  'mouth-smile': () => <path d="M53 61 Q60 68 67 61" stroke={INK} strokeWidth={2.5} fill="none" />,
  'mouth-grin': () => (
    <>
      <path d="M52 60 H68 Q60 72 52 60 Z" fill={INK} />
      <rect x={54} y={60} width={12} height={3} fill={WHITE} />
    </>
  ),
  'mouth-open': () => <ellipse cx={60} cy={63} rx={4} ry={5} fill={INK} />,
  'mouth-flat': () => <path d="M54 63 H66" stroke={INK} strokeWidth={2.5} />,
  'mouth-tongue': () => (
    <>
      <path d="M53 61 Q60 68 67 61" stroke={INK} strokeWidth={2.5} fill="none" />
      <path d="M58 65 h5 v3 a2.5 2.5 0 0 1 -5 0 Z" fill="#F062A8" />
    </>
  ),
  'mouth-smirk': () => <path d="M54 63 Q62 66 67 59" stroke={INK} strokeWidth={2.5} fill="none" />,
  'mouth-wow': () => <circle cx={60} cy={63} r={3} fill={INK} />,
  'mouth-teeth': () => (
    <rect x={53} y={60} width={14} height={6} rx={2} fill={WHITE} stroke={INK} strokeWidth={1.5} />
  ),
  'mouth-whistle': () => (
    <circle cx={62} cy={63} r={2.5} fill="none" stroke={INK} strokeWidth={2} />
  ),
  'mouth-braces': () => (
    <>
      <path d="M52 60 H68 Q60 72 52 60 Z" fill={INK} />
      <rect x={54} y={60} width={12} height={3} fill={WHITE} />
      <path d="M54 61.5 H66" stroke="#8A8A99" strokeWidth={1} />
    </>
  ),
};

const FACIAL_HAIR: Record<string, Draw> = {
  none: nothing,
  stubble: ({ hair }) => (
    <polygon points="42,60 50,72 70,72 78,60 72,68 48,68" fill={hair} opacity={0.35} />
  ),
  moustache: ({ hair }) => <path d="M52 59 Q60 54 68 59 Q60 57 52 59 Z" fill={hair} />,
  goatee: ({ hair }) => <polygon points="55,67 65,67 63,75 57,75" fill={hair} />,
  'full-beard': ({ hair }) => (
    <path
      d="M40 56 L42 64 L50 76 H70 L78 64 L80 56 L74 66 H46 Z M52 59 Q60 54 68 59 Q60 57 52 59 Z"
      fill={hair}
    />
  ),
};

interface Hair {
  back?: Draw;
  front: Draw;
}

const shortFront: Draw = ({ hair }) => (
  <polygon points="38,44 40,34 48,24 72,24 80,34 82,44 76,36 44,36" fill={hair} />
);

export const HAIR_STYLES: Record<string, Hair> = {
  short: { front: shortFront },
  buzz: {
    front: ({ hair }) => (
      <polygon points="41,38 48,27 72,27 79,38 72,32 48,32" fill={hair} opacity={0.85} />
    ),
  },
  curly: {
    front: ({ hair }) => (
      <g fill={hair}>
        {[42, 50, 58, 66, 74, 78, 40].map((x, i) => (
          <circle key={x} cx={x} cy={i > 4 ? 40 : 30 - (i % 2) * 3} r={7} />
        ))}
      </g>
    ),
  },
  afro: {
    back: ({ hair }) => <circle cx={60} cy={44} r={32} fill={hair} />,
    front: ({ hair }) => <polygon points="42,38 50,30 70,30 78,38 70,34 50,34" fill={hair} />,
  },
  bob: {
    back: ({ hair }) => <polygon points="36,40 46,22 74,22 84,40 84,70 36,70" fill={hair} />,
    front: ({ hair }) => <polygon points="40,42 46,28 74,28 80,42 70,36 50,36" fill={hair} />,
  },
  long: {
    back: ({ hair }) => <polygon points="36,40 46,22 74,22 84,40 88,94 32,94" fill={hair} />,
    front: ({ hair }) => <polygon points="40,44 46,26 74,26 80,44 66,34 54,34" fill={hair} />,
  },
  ponytail: {
    back: ({ hair }) => <polygon points="78,34 92,40 96,70 86,72 82,46" fill={hair} />,
    front: shortFront,
  },
  bun: {
    back: ({ hair }) => <circle cx={60} cy={18} r={9} fill={hair} />,
    front: shortFront,
  },
  braids: {
    back: ({ hair }) => (
      <g fill={hair}>
        <polygon points="36,40 46,22 74,22 84,40 84,50 36,50" />
        {[38, 78].map((x) =>
          [52, 62, 72, 82].map((y) => <circle key={`${x}-${y}`} cx={x + 2} cy={y} r={5} />),
        )}
      </g>
    ),
    front: ({ hair }) => <polygon points="40,40 48,26 72,26 80,40 60,32" fill={hair} />,
  },
  bald: { front: nothing },
  spiky: {
    front: ({ hair }) => (
      <polygon
        points="38,42 40,30 44,32 46,18 52,28 58,14 62,27 70,16 72,29 78,22 80,34 82,42 76,36 44,36"
        fill={hair}
      />
    ),
  },
  mohawk: {
    front: ({ hair }) => <polygon points="54,34 52,22 56,10 64,10 68,22 66,34" fill={hair} />,
  },
  'side-part': {
    front: ({ hair }) => (
      <polygon points="38,46 40,32 50,22 74,24 82,36 82,44 70,32 56,36 44,38" fill={hair} />
    ),
  },
  quiff: {
    front: ({ hair }) => (
      <polygon points="38,44 40,32 46,26 52,14 68,12 76,20 80,32 82,44 76,36 44,36" fill={hair} />
    ),
  },
  'space-buns': {
    back: ({ hair }) => (
      <g fill={hair}>
        <circle cx={42} cy={24} r={9} />
        <circle cx={78} cy={24} r={9} />
      </g>
    ),
    front: shortFront,
  },
  locs: {
    back: ({ hair }) => (
      <g fill={hair}>
        <polygon points="36,40 46,22 74,22 84,40 84,46 36,46" />
        {[36, 42, 74, 80].map((x) => (
          <rect key={x} x={x} y={40} width={5} height={44} rx={2.5} />
        ))}
      </g>
    ),
    front: ({ hair }) => <polygon points="40,42 48,26 72,26 80,42 72,34 48,34" fill={hair} />,
  },
};

const topBase = (fill: string) => <path d={BODY} fill={fill} />;
const darker = 'rgba(0,0,0,0.18)';
const lighter = 'rgba(255,255,255,0.45)';

const hoodie = (fill: string) => (
  <>
    <path d="M40 90 Q60 74 80 90 L74 86 H46 Z" fill={fill} stroke={darker} strokeWidth={2} />
    {topBase(fill)}
    <path d="M54 90 V102 M66 90 V102" stroke={lighter} strokeWidth={2} />
    <path d="M44 108 H76 V118 H44 Z" fill={darker} />
  </>
);

const TOPS: Record<string, Draw> = {
  't-shirt': ({ top }) => (
    <>
      {topBase(top)}
      <path d="M50 84 L60 94 L70 84" fill="none" stroke={darker} strokeWidth={3} />
    </>
  ),
  hoodie: ({ top }) => hoodie(top),
  jumper: ({ top }) => (
    <>
      {topBase(top)}
      <path d="M26 112 H94 M27 116 H93" stroke={darker} strokeWidth={2} />
      <path d="M48 84 Q60 92 72 84" fill="none" stroke={darker} strokeWidth={3} />
    </>
  ),
  shirt: ({ top }) => (
    <>
      {topBase(top)}
      <polygon points="46,84 60,94 52,98" fill={WHITE} stroke={darker} />
      <polygon points="74,84 60,94 68,98" fill={WHITE} stroke={darker} />
      {[100, 108, 116].map((y) => (
        <circle key={y} cx={60} cy={y} r={1.5} fill={darker} />
      ))}
    </>
  ),
  'sports-top': ({ top }) => (
    <>
      {topBase(top)}
      <path d="M28 94 L32 120 M92 94 L88 120" stroke={WHITE} strokeWidth={4} />
      <path d="M50 84 Q60 90 70 84" fill="none" stroke={WHITE} strokeWidth={3} />
    </>
  ),
  jacket: ({ top }) => (
    <>
      {topBase(top)}
      <polygon points="46,84 60,120 52,120 40,92" fill={darker} />
      <polygon points="74,84 60,120 68,120 80,92" fill={darker} />
      <polygon points="52,86 60,100 68,86" fill={WHITE} />
    </>
  ),
  'band-tee': ({ top }) => (
    <>
      {topBase(top)}
      <polygon points="62,94 52,108 59,108 56,118 68,102 61,102 64,94" fill={GOLD} />
    </>
  ),
  'denim-jacket': ({ top }) => (
    <>
      {topBase(top)}
      <path d="M60 86 V120" stroke={darker} strokeWidth={2} />
      <rect x={40} y={98} width={12} height={9} fill="none" stroke={lighter} strokeWidth={2} />
      <rect x={68} y={98} width={12} height={9} fill="none" stroke={lighter} strokeWidth={2} />
    </>
  ),
  'striped-top': ({ top }) => (
    <>
      {topBase(top)}
      {[96, 104, 112].map((y) => (
        <path key={y} d={`M26 ${y} H94`} stroke={lighter} strokeWidth={4} />
      ))}
    </>
  ),
  gilet: ({ top }) => (
    <>
      {topBase(WHITE)}
      <path d="M34 92 L46 84 L58 92 L58 120 H32 Z M86 92 L74 84 L62 92 L62 120 H88 Z" fill={top} />
      <path d="M60 90 V120" stroke={INK} strokeWidth={1.5} />
    </>
  ),
  'gold-hoodie': () => (
    <>
      {hoodie(GOLD)}
      <path d="M32 100 L40 96 M84 96 L90 100" stroke={WHITE} strokeWidth={3} opacity={0.8} />
    </>
  ),
  'captain-shirt': ({ top }) => (
    <>
      {topBase(top)}
      <path d="M50 84 Q60 90 70 84" fill="none" stroke={WHITE} strokeWidth={3} />
      <rect x={84} y={98} width={10} height={8} rx={1} fill={GOLD} transform="rotate(14 89 102)" />
      <text
        x={89}
        y={105}
        fontSize={7}
        fontWeight={900}
        textAnchor="middle"
        fill={INK}
        transform="rotate(14 89 102)"
      >
        C
      </text>
    </>
  ),
  // Year chapter finales (original art).
  'chapter-hoodie': ({ top }) => (
    <>
      {hoodie(top)}
      <circle cx={60} cy={104} r={7} fill={WHITE} />
      <text x={60} y={107.5} fontSize={9} fontWeight={900} textAnchor="middle" fill={INK}>
        1
      </text>
    </>
  ),
  'bomber-jacket': () => (
    <>
      {topBase('#3F5D3A')}
      <path d="M26 114 H94 V120 H26 Z" fill="#C8102E" opacity={0.85} />
      <path d="M48 84 Q60 92 72 84" fill="none" stroke="#C8102E" strokeWidth={4} />
      <path d="M60 88 V120" stroke={GOLD} strokeWidth={2} />
      <rect x={38} y={98} width={8} height={6} rx={1} fill="#FF7A2F" />
    </>
  ),
  'gcse-finisher-jacket': () => (
    <>
      {topBase('#1E2A78')}
      <path d="M40 92 L60 120 L80 92" fill="none" stroke={GOLD} strokeWidth={4} />
      <path d="M26 112 H94" stroke={GOLD} strokeWidth={2} />
      <polygon
        points="86,96 88,101 93,101 89,104 91,109 86,106 81,109 83,104 79,101 84,101"
        fill={GOLD}
        stroke={GOLD_EDGE}
        strokeWidth={0.8}
      />
    </>
  ),
  'sixth-form-coat': () => (
    <>
      {topBase('#5B3A29')}
      <polygon points="46,84 60,104 52,120 38,92" fill="#4A2F21" />
      <polygon points="74,84 60,104 68,120 82,92" fill="#4A2F21" />
      <polygon points="52,86 60,100 68,86" fill="#F2E6D8" />
      {[108, 116].map((y) => (
        <circle key={y} cx={64} cy={y} r={1.6} fill={GOLD} />
      ))}
    </>
  ),
  'a-level-finisher-jacket': () => (
    <>
      {topBase('#5A1E78')}
      <path d="M40 92 L60 120 L80 92" fill="none" stroke={GOLD} strokeWidth={4} />
      <path d="M26 108 H94 M26 113 H94" stroke={GOLD} strokeWidth={1.5} />
      <path
        d="M82 96 L90 96 L86 104 Z M86 104 V110"
        fill={GOLD}
        stroke={GOLD_EDGE}
        strokeWidth={0.8}
      />
    </>
  ),
};

const lensPair = (draw: (x: number) => ReactNode, bridge = true) => (
  <>
    {pair(draw)}
    {bridge && <path d="M57 50 H63" stroke={INK} strokeWidth={2} />}
  </>
);

const EYEWEAR: Record<string, Draw> = {
  none: nothing,
  'round-glasses': () =>
    lensPair((x) => <circle cx={x} cy={50} r={6} fill="none" stroke={INK} strokeWidth={2} />),
  'square-glasses': () =>
    lensPair((x) => (
      <rect
        x={x - 6}
        y={45}
        width={12}
        height={10}
        rx={1.5}
        fill="none"
        stroke={INK}
        strokeWidth={2}
      />
    )),
  sunglasses: () =>
    lensPair((x) => <rect x={x - 6.5} y={45} width={13} height={9} rx={4} fill={INK} />),
  'sport-goggles': () => (
    <>
      <path d="M40 50 H80" stroke="#FF7A2F" strokeWidth={4} />
      <rect
        x={43}
        y={44}
        width={34}
        height={12}
        rx={6}
        fill="#2F6FDE"
        opacity={0.8}
        stroke={INK}
        strokeWidth={1.5}
      />
    </>
  ),
  'pixel-shades': () => (
    <path d="M42 46 H78 V50 H74 V54 H64 V50 H56 V54 H46 V50 H42 Z" fill={INK} />
  ),
  'heart-glasses': () =>
    lensPair((x) => (
      <path
        d={`M${x} 56 L${x - 6} 49 A3.2 3.2 0 0 1 ${x} 45.5 A3.2 3.2 0 0 1 ${x + 6} 49 Z`}
        fill="#F062A8"
        stroke={INK}
        strokeWidth={1}
      />
    )),
  'night-vision': () => (
    <>
      <path d="M40 46 H80" stroke={INK} strokeWidth={3} />
      {pair((x) => (
        <>
          <rect x={x - 6} y={44} width={12} height={12} rx={2} fill={INK} />
          <circle cx={x} cy={50} r={4} fill="#39FF14" />
        </>
      ))}
    </>
  ),
  'laser-visor': () => (
    <>
      <rect x={40} y={44} width={40} height={11} rx={3} fill="#FF2E4D" opacity={0.75} />
      <path d="M42 49.5 H78" stroke={WHITE} strokeWidth={1.5} opacity={0.9} />
    </>
  ),
};

const HEADWEAR: Record<string, Draw> = {
  none: nothing,
  cap: () => (
    <>
      <path d="M38 36 Q40 18 60 18 Q80 18 82 36 Z" fill="#D63A3A" />
      <path d="M60 34 H96 L92 39 H60 Z" fill="#8E1B1B" />
    </>
  ),
  beanie: () => (
    <>
      <path d="M38 36 Q40 14 60 14 Q80 14 82 36 Z" fill="#14928C" />
      <rect x={37} y={32} width={46} height={7} rx={2} fill="#0E6B66" />
      <circle cx={60} cy={12} r={5} fill={WHITE} />
    </>
  ),
  headband: () => <rect x={39} y={34} width={42} height={6} rx={2} fill="#F062A8" />,
  'bucket-hat': () => (
    <>
      <path d="M44 34 L46 18 H74 L76 34 Z" fill="#F5E3B8" stroke={darker} />
      <path d="M32 38 L44 32 H76 L88 38 Z" fill="#E8C46A" />
    </>
  ),
  headphones: () => (
    <>
      <path d="M38 50 V40 Q38 20 60 20 Q82 20 82 40 V50" fill="none" stroke={INK} strokeWidth={4} />
      <rect x={33} y={44} width={9} height={16} rx={3} fill="#6C47F5" />
      <rect x={78} y={44} width={9} height={16} rx={3} fill="#6C47F5" />
    </>
  ),
  'pixel-helmet': () => (
    <path
      d="M38 44 V30 H42 V24 H48 V20 H72 V24 H78 V30 H82 V44 H76 V34 H44 V44 Z"
      fill="#8A8A99"
      stroke={INK}
      strokeWidth={1.5}
    />
  ),
  'fox-ears': () => (
    <>
      <polygon points="40,36 42,14 56,30" fill="#FF7A2F" />
      <polygon points="80,36 78,14 64,30" fill="#FF7A2F" />
      <polygon points="44,32 45,20 52,29" fill="#3A2622" />
      <polygon points="76,32 75,20 68,29" fill="#3A2622" />
    </>
  ),
  'backwards-cap': () => (
    <>
      <path d="M38 36 Q40 18 60 18 Q80 18 82 36 Z" fill="#2F6FDE" />
      <path d="M38 34 H26 L28 39 H40 Z" fill="#1F4FA8" />
    </>
  ),
  bandana: () => (
    <>
      <path d="M38 38 Q40 20 60 20 Q80 20 82 38 Z" fill="#D63A3A" />
      <polygon points="80,34 92,30 90,40" fill="#D63A3A" />
      {[48, 60, 72].map((x) => (
        <circle key={x} cx={x} cy={30} r={1.5} fill={WHITE} />
      ))}
    </>
  ),
  crown: () => (
    <polygon
      points="42,34 42,16 50,26 60,12 70,26 78,16 78,34"
      fill={GOLD}
      stroke={GOLD_EDGE}
      strokeWidth={1.5}
    />
  ),
  'dino-hood': () => (
    <>
      <path
        d="M34 66 V36 Q34 14 60 14 Q86 14 86 36 V66 L80 66 V38 Q80 24 60 24 Q40 24 40 38 V66 Z"
        fill="#4CAF50"
      />
      {[44, 54, 64, 74].map((x) => (
        <polygon key={x} points={`${x},16 ${x + 5},6 ${x + 10},16`} fill="#FFC83D" />
      ))}
    </>
  ),
  // Seasonal drop: Frost Fest 2026 (original art).
  'bobble-hat': () => (
    <>
      <path d="M36 40 Q36 14 60 14 Q84 14 84 40 Z" fill="#2E86AB" />
      <path d="M36 36 H84 V44 H36 Z" fill={WHITE} />
      {[44, 54, 64, 74].map((x) => (
        <path key={x} d={`M${x} 26 l4 -4 l4 4`} fill="none" stroke={WHITE} strokeWidth={2} />
      ))}
      <circle cx={60} cy={11} r={6} fill={WHITE} />
    </>
  ),
};

const HELD: Record<string, Draw> = {
  none: nothing,
  // Seasonal drop: Frost Fest 2026 (original art).
  lantern: () => (
    <>
      <path d="M98 78 V86" stroke={INK} strokeWidth={1.5} />
      <ellipse cx={98} cy={100} rx={11} ry={14} fill="#E94F37" />
      <path
        d="M90 90 Q98 100 90 110 M106 90 Q98 100 106 110"
        fill="none"
        stroke="#B83A28"
        strokeWidth={1.5}
      />
      <ellipse cx={98} cy={100} rx={4} ry={6} fill={GOLD} opacity={0.9} />
      <rect x={93} y={85} width={10} height={3} fill={INK} />
      <rect x={93} y={113} width={10} height={3} fill={INK} />
    </>
  ),
  guitar: () => (
    <>
      <rect x={96} y={62} width={5} height={36} fill="#6B4226" transform="rotate(20 98 80)" />
      <circle cx={92} cy={104} r={11} fill="#D63A3A" />
      <circle cx={95} cy={96} r={8} fill="#D63A3A" />
      <circle cx={93} cy={102} r={3} fill={INK} />
    </>
  ),
  football: () => (
    <>
      <circle cx={98} cy={104} r={11} fill={WHITE} stroke={INK} strokeWidth={1.5} />
      <polygon points="98,99 103,103 101,109 95,109 93,103" fill={INK} />
    </>
  ),
  skateboard: () => (
    <g transform="rotate(-70 98 96)">
      <rect x={76} y={92} width={44} height={9} rx={4.5} fill="#6C47F5" />
      <circle cx={84} cy={104} r={3} fill={INK} />
      <circle cx={112} cy={104} r={3} fill={INK} />
    </g>
  ),
  controller: () => (
    <>
      <path
        d="M82 98 Q82 90 90 90 H106 Q114 90 114 98 L116 108 Q116 114 110 112 L104 106 H92 L86 112 Q80 114 80 108 Z"
        fill="#2B2B3A"
      />
      <path d="M89 96 V102 M86 99 H92" stroke={WHITE} strokeWidth={2} />
      <circle cx={105} cy={97} r={1.8} fill="#FF7A2F" />
      <circle cx={109} cy={101} r={1.8} fill="#0B8457" />
    </>
  ),
  pickaxe: () => (
    <>
      <rect x={96} y={78} width={5} height={40} fill="#8E5B2E" transform="rotate(-25 98 98)" />
      <path
        d="M82 84 Q98 72 116 82 L112 86 Q98 80 86 88 Z"
        fill="#8A8A99"
        stroke={INK}
        strokeWidth={1}
      />
    </>
  ),
  clapperboard: () => (
    <>
      <rect x={84} y={96} width={28} height={20} fill={INK} />
      <path d="M84 88 L112 84 L113 92 L85 96 Z" fill={WHITE} stroke={INK} strokeWidth={1} />
      <path d="M90 87 L93 95 M98 86 L101 94 M106 85 L109 93" stroke={INK} strokeWidth={2.5} />
    </>
  ),
  popcorn: () => (
    <>
      {[88, 96, 104, 92, 100].map((x, i) => (
        <circle key={i} cx={x} cy={i > 2 ? 88 : 92} r={5} fill="#FFF0A3" />
      ))}
      <polygon points="84,94 110,94 106,118 88,118" fill={WHITE} />
      <path d="M90 94 L92 118 M97 94 V118 M104 94 L102 118" stroke="#D63A3A" strokeWidth={3} />
    </>
  ),
  microphone: () => (
    <>
      <rect x={95} y={92} width={6} height={24} rx={2} fill={INK} transform="rotate(15 98 104)" />
      <circle cx={95} cy={88} r={7} fill="#8A8A99" stroke={INK} strokeWidth={1.5} />
    </>
  ),
  drumsticks: () => (
    <>
      <path
        d="M84 116 L108 82 M92 118 L114 88"
        stroke="#C99A5B"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <circle cx={108} cy={82} r={2.5} fill="#E8C46A" />
      <circle cx={114} cy={88} r={2.5} fill="#E8C46A" />
    </>
  ),
  trophy: () => (
    <>
      <path
        d="M86 86 H110 V94 Q110 106 98 106 Q86 106 86 94 Z"
        fill={GOLD}
        stroke={GOLD_EDGE}
        strokeWidth={1.5}
      />
      <rect x={95} y={106} width={6} height={6} fill={GOLD_EDGE} />
      <rect x={88} y={112} width={20} height={5} fill={GOLD} />
    </>
  ),
  'dino-buddy': () => (
    <>
      <path
        d="M84 116 Q82 100 94 98 L100 86 Q106 82 110 88 L106 98 Q114 104 112 116 Z"
        fill="#4CAF50"
      />
      <circle cx={105} cy={88} r={1.5} fill={INK} />
      <polygon points="88,100 90,94 94,99" fill="#FFC83D" />
    </>
  ),
  'pixel-sword': () => (
    <path
      d="M108 76 H114 V82 H110 V86 H106 V90 H102 V94 H98 V98 H102 V102 H98 V106 H94 V110 H90 V106 H86 V102 H90 V98 H94 V94 H98 V90 H102 V86 H106 V82 H108 Z"
      fill="#7FD6F5"
      stroke={INK}
      strokeWidth={1.2}
    />
  ),
};

const PATTERN_FILL = 'rgba(255,255,255,0.45)';
const grid = (step: number, draw: (x: number, y: number) => ReactNode) => {
  const shapes: ReactNode[] = [];
  for (let y = step / 2; y < 120; y += step) {
    for (let x = step / 2; x < 120; x += step) shapes.push(draw(x, y));
  }
  return shapes;
};

const PATTERNS: Record<string, Draw> = {
  none: nothing,
  dots: () =>
    grid(15, (x, y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill={PATTERN_FILL} />),
  stripes: () =>
    [0, 20, 40, 60, 80, 100].map((y) => (
      <rect key={y} x={0} y={y} width={120} height={8} fill={PATTERN_FILL} />
    )),
  zigzag: () =>
    [15, 45, 75, 105].map((y) => (
      <path
        key={y}
        d={`M0 ${y} l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8`}
        fill="none"
        stroke={PATTERN_FILL}
        strokeWidth={4}
      />
    )),
  stars: () =>
    grid(30, (x, y) => (
      <polygon
        key={`${x}-${y}`}
        points={`${x},${y - 5} ${x + 1.5},${y - 1.5} ${x + 5},${y - 1.5} ${x + 2},${y + 1} ${x + 3},${y + 5} ${x},${y + 2.5} ${x - 3},${y + 5} ${x - 2},${y + 1} ${x - 5},${y - 1.5} ${x - 1.5},${y - 1.5}`}
        fill={PATTERN_FILL}
      />
    )),
  checks: () =>
    grid(20, (x, y) =>
      (Math.floor(x / 20) + Math.floor(y / 20)) % 2 === 0 ? (
        <rect key={`${x}-${y}`} x={x - 10} y={y - 10} width={20} height={20} fill={PATTERN_FILL} />
      ) : null,
    ),
  waves: () =>
    [20, 50, 80, 110].map((y) => (
      <path
        key={y}
        d={`M0 ${y} q15 -10 30 0 t30 0 t30 0 t30 0`}
        fill="none"
        stroke={PATTERN_FILL}
        strokeWidth={4}
      />
    )),
  pixels: () =>
    grid(12, (x, y) =>
      (x * 7 + y * 3) % 5 === 0 ? (
        <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width={8} height={8} fill={PATTERN_FILL} />
      ) : null,
    ),
};

const SCENES: Record<string, Draw> = {
  none: nothing,
  pitch: () => (
    <>
      <rect x={0} y={84} width={120} height={36} fill="#4CAF50" />
      <path d="M0 100 H120 M60 84 V120" stroke={WHITE} strokeWidth={1.5} opacity={0.8} />
      <path d="M4 84 V64 H24 V84" fill="none" stroke={WHITE} strokeWidth={2} />
    </>
  ),
  'skate-park': () => (
    <>
      <rect x={0} y={96} width={120} height={24} fill="#A0A7B4" />
      <path d="M0 60 Q0 96 36 96 H0 Z" fill="#C3C8D1" />
      <path d="M120 60 Q120 96 84 96 H120 Z" fill="#C3C8D1" />
    </>
  ),
  'gig-stage': () => (
    <>
      <polygon points="10,0 26,0 44,100 0,100" fill="#FFF0A3" opacity={0.5} />
      <polygon points="94,0 110,0 120,100 76,100" fill="#FFF0A3" opacity={0.5} />
      <rect x={0} y={100} width={120} height={20} fill="#3A2622" />
    </>
  ),
  'pixel-hills': () => (
    <>
      <path
        d="M0 120 V92 H12 V84 H24 V76 H36 V88 H48 V96 H72 V86 H84 V74 H96 V82 H108 V90 H120 V120 Z"
        fill="#4CAF50"
      />
      <path d="M14 20 H34 V26 H40 V32 H8 V26 H14 Z" fill={WHITE} opacity={0.9} />
    </>
  ),
  cinema: () => (
    <>
      <rect x={20} y={8} width={80} height={44} fill={WHITE} opacity={0.85} />
      <path d="M0 0 H22 Q14 60 0 120 Z" fill="#B71C1C" />
      <path d="M120 0 H98 Q106 60 120 120 Z" fill="#B71C1C" />
    </>
  ),
  vinyl: () => (
    <>
      <circle cx={92} cy={30} r={26} fill={INK} />
      <circle cx={92} cy={30} r={18} fill="none" stroke="#4A4A5C" strokeWidth={1} />
      <circle cx={92} cy={30} r={8} fill="#FF7A2F" />
      <circle cx={92} cy={30} r={1.5} fill={INK} />
    </>
  ),
  jungle: () => (
    <>
      {[
        [0, 20, -30],
        [110, 30, 200],
        [10, 90, 20],
        [108, 96, 160],
      ].map(([x, y, r]) => (
        <ellipse
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          rx={26}
          ry={10}
          fill="#2E7D32"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
      <rect x={0} y={108} width={120} height={12} fill="#33691E" />
    </>
  ),
  space: () => (
    <>
      <rect x={0} y={0} width={120} height={120} fill="#1F2A5C" />
      {[
        [12, 14],
        [30, 40],
        [100, 12],
        [110, 60],
        [16, 80],
        [52, 8],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={WHITE} />
      ))}
      <circle cx={98} cy={30} r={12} fill="#FF7A2F" />
      <ellipse cx={98} cy={30} rx={20} ry={4} fill="none" stroke={GOLD} strokeWidth={2} />
    </>
  ),
  // Chapter 2 finale (original art): a city rooftop at dusk with water tanks.
  rooftop: () => (
    <>
      <rect x={0} y={0} width={120} height={120} fill="#3B2A5C" />
      <circle cx={96} cy={22} r={9} fill="#FFD27A" />
      {[
        [0, 60, 18],
        [20, 48, 14],
        [100, 54, 20],
      ].map(([x, y, w]) => (
        <rect key={x} x={x} y={y} width={w} height={60} fill="#241A3A" />
      ))}
      {[
        [4, 66],
        [24, 54],
        [104, 62],
        [110, 74],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#FFD27A" />
      ))}
      <rect x={0} y={104} width={120} height={16} fill="#5A4A6E" />
      <path d="M0 104 H120" stroke="#7A6A8E" strokeWidth={2} />
    </>
  ),
  // Seasonal drop: Frost Fest 2026 (original art).
  'frosty-night': () => (
    <>
      <rect x={0} y={0} width={120} height={120} fill="#16324F" />
      {[
        [14, 18],
        [40, 10],
        [104, 16],
        [88, 44],
        [10, 58],
        [112, 70],
      ].map(([x = 0, y = 0]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x - 3} ${y} H${x + 3} M${x} ${y - 3} V${y + 3}`}
          stroke={WHITE}
          strokeWidth={1.2}
        />
      ))}
      <path d="M0 100 Q30 92 60 100 Q90 108 120 98 V120 H0 Z" fill="#E8F1F8" />
    </>
  ),
};

/** Extra details drawn on top of the head for special skins. */
export const SKIN_DETAILS: Record<string, ReactNode> = {
  alien: (
    <>
      <path d="M50 28 L44 14 M70 28 L76 14" stroke="#4E9A2E" strokeWidth={2} />
      <circle cx={44} cy={13} r={3} fill="#4E9A2E" />
      <circle cx={76} cy={13} r={3} fill="#4E9A2E" />
    </>
  ),
  robot: (
    <>
      {[
        [44, 40],
        [76, 40],
        [44, 60],
        [76, 60],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="#6B7585" />
      ))}
      <path d="M60 28 V18" stroke="#6B7585" strokeWidth={2} />
      <circle cx={60} cy={16} r={3} fill="#D63A3A" />
    </>
  ),
};

export const DRAWINGS: Partial<Record<AvatarLayer, Record<string, Draw>>> = {
  eyes: EYES,
  mouth: MOUTHS,
  facialHair: FACIAL_HAIR,
  top: TOPS,
  eyewear: EYEWEAR,
  headwear: HEADWEAR,
  heldItem: HELD,
  pattern: PATTERNS,
  scene: SCENES,
};

const COLOUR_MAPS: Partial<Record<AvatarLayer, Record<string, string>>> = {
  skin: SKIN,
  hairColour: HAIR,
  topColour: TOP_COLOUR,
  backgroundColour: BACKGROUND,
};

export function hasArt(layer: AvatarLayer, id: string): boolean {
  if (layer === 'hairStyle') return id in HAIR_STYLES;
  return id in (COLOUR_MAPS[layer] ?? DRAWINGS[layer] ?? {});
}

export function colourOf(layer: AvatarLayer, id: string): string | undefined {
  return COLOUR_MAPS[layer]?.[id];
}
