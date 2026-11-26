import { useId, type ReactNode } from 'react';
import type { Outfit, OutfitItem, OutfitProp, UnisexTouch } from './outfits';
import './pip.css';

/**
 * Pip, the fox, drawn in code (J15b). Original art: the angular fox from `components/Pip.tsx`,
 * now with shoulders so the arm grows from the body, leaning out of a round frame: the top of the
 * ring sits behind his head and the bottom in front of his body. Layers (ring, tint, body, arm,
 * head, outfit item, touch, prop) combine freely. Decorative: whatever holds Pip gives the name.
 */

/** Where the arm joins the body; the arm turns about this point in every pose. */
export const SHOULDER = { x: 86, y: 106 } as const;

export type PipPose =
  'rest' | 'blink' | 'wave' | 'stretch' | 'read' | 'timer' | 'cheer' | 'nap' | 'nod' | 'encourage';

/** Moves a point of the original 120 × 120 head onto the figure (smaller, a little lower). */
const head = (points: string) =>
  points
    .split(' ')
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number) as [number, number];
      return `${(60 + (x - 60) * 0.7).toFixed(1)},${(60 + (y - 57) * 0.7).toFixed(1)}`;
    })
    .join(' ');

const ORANGE = '#FF7A2F';
const ORANGE_SIDE = '#E35F17';
const DARK = '#3A2622';
const CREAM = '#F7F3EE';
const INK = '#2b2a3a';

function Item({ item }: { item: OutfitItem }): ReactNode {
  switch (item) {
    case 'pencil':
      return (
        <g data-item="pencil">
          <path d="M22 54 L42 32" stroke="#ffc83d" strokeWidth="6" strokeLinecap="butt" />
          <path d="M42 32 L46 28" stroke="#f7c6a3" strokeWidth="6" />
          <path d="M22 54 L19 57" stroke="#ff8fb1" strokeWidth="6" />
          <path d="M46 28 L49 25" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'round-glasses':
      return (
        <g data-item="round-glasses" fill="rgb(255 255 255 / 25%)" stroke={INK} strokeWidth="2.2">
          <circle cx="50" cy="61" r="7.5" />
          <circle cx="70" cy="61" r="7.5" />
          <path d="M57.5 61 Q60 58 62.5 61" fill="none" />
        </g>
      );
    case 'goggles':
      return (
        <g data-item="goggles" stroke={INK} strokeWidth="2">
          <path d="M31 47 L89 47" strokeWidth="4" stroke="#4f5b77" />
          <circle cx="50" cy="46" r="7" fill="#bfe6ff" />
          <circle cx="70" cy="46" r="7" fill="#bfe6ff" />
        </g>
      );
    case 'lab-collar':
      return (
        <g data-item="lab-collar" fill="#ffffff" stroke={INK} strokeWidth="1.6">
          <polygon points="40,100 58,100 50,118" />
          <polygon points="62,100 80,100 70,118" />
        </g>
      );
    case 'leaf':
      return (
        <g data-item="leaf">
          <path
            d="M60 40 C 52 30 56 20 66 18 C 70 28 68 36 60 40 Z"
            fill="#43c46b"
            stroke={INK}
            strokeWidth="1.6"
          />
          <path d="M60 40 L64 26" stroke={INK} strokeWidth="1.2" />
        </g>
      );
    case 'ruff':
      return (
        <g data-item="ruff">
          <ellipse
            cx="60"
            cy="100"
            rx="22"
            ry="6"
            fill="#ffffff"
            stroke={INK}
            strokeWidth="1.6"
            strokeDasharray="4 2"
          />
        </g>
      );
    case 'explorer-hat':
      return (
        <g data-item="explorer-hat" stroke={INK} strokeWidth="1.8">
          <path d="M42 38 Q60 14 78 38 Z" fill="#c9a86a" />
          <ellipse cx="60" cy="38" rx="27" ry="5" fill="#b8955a" />
          <path d="M43 35 L77 35" stroke="#7a5a2e" strokeWidth="3" />
        </g>
      );
    case 'beret':
      return (
        <g data-item="beret" stroke={INK} strokeWidth="1.6">
          <ellipse cx="64" cy="34" rx="19" ry="7" fill="#b8323a" transform="rotate(-12 64 34)" />
          <circle cx="66" cy="26" r="2.5" fill="#b8323a" />
        </g>
      );
    case 'headset':
      return (
        <g data-item="headset" stroke={INK} strokeWidth="2">
          <path
            d="M33 60 Q33 30 60 30 Q87 30 87 60"
            fill="none"
            strokeWidth="3.5"
            stroke="#4f5b77"
          />
          <rect x="28" y="56" width="9" height="14" rx="3" fill="#4f5b77" />
          <rect x="83" y="56" width="9" height="14" rx="3" fill="#4f5b77" />
          <path d="M33 70 Q38 84 52 86" fill="none" strokeWidth="2" />
          <circle cx="53" cy="86" r="2.5" fill={INK} />
        </g>
      );
    case 'bow-tie':
      return (
        <g data-item="bow-tie" fill="#6c47f5" stroke={INK} strokeWidth="1.4">
          <polygon points="60,101 48,95 48,107" />
          <polygon points="60,101 72,95 72,107" />
          <circle cx="60" cy="101" r="2.5" />
        </g>
      );
  }
}

function Prop({ prop }: { prop: OutfitProp }): ReactNode {
  const common = { stroke: INK, strokeWidth: 1.6 };
  const body = (() => {
    switch (prop) {
      case 'protractor':
        return (
          <g {...common}>
            <path d="M18 128 A12 12 0 0 1 42 128 Z" fill="#fffbe0" />
            <path d="M30 128 L30 121 M24 124 L26 126 M36 124 L34 126" />
          </g>
        );
      case 'magnet':
        return (
          <g {...common}>
            <path
              d="M22 112 L22 124 A8 8 0 0 0 38 124 L38 112 L33 112 L33 124 A3 3 0 0 1 27 124 L27 112 Z"
              fill="#e0453a"
            />
            <rect x="22" y="110" width="5" height="4" fill="#d9d9e3" />
            <rect x="33" y="110" width="5" height="4" fill="#d9d9e3" />
          </g>
        );
      case 'test-tube':
        return (
          <g {...common} transform="rotate(-20 30 120)">
            <path d="M26 106 L26 128 A4 4 0 0 0 34 128 L34 106 Z" fill="#ffffff" />
            <path d="M26 118 L34 118 L34 128 A4 4 0 0 1 26 128 Z" fill="#43c46b" />
          </g>
        );
      case 'magnifier':
        return (
          <g {...common}>
            <circle cx="28" cy="116" r="7" fill="#dff1ff" />
            <path d="M33 121 L40 130" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        );
      case 'quill':
        return (
          <g {...common}>
            <path d="M22 132 C 26 118 34 108 42 104 C 40 114 32 124 22 132 Z" fill="#ffffff" />
            <path d="M22 132 L34 116" />
          </g>
        );
      case 'scroll':
        return (
          <g {...common}>
            <rect x="20" y="112" width="20" height="14" fill="#f6e3b4" />
            <circle cx="20" cy="119" r="3" fill="#e7cd8e" />
            <circle cx="40" cy="119" r="3" fill="#e7cd8e" />
          </g>
        );
      case 'croissant':
        return (
          <g {...common}>
            <path d="M18 124 Q30 104 42 124 Q36 118 30 118 Q24 118 18 124 Z" fill="#e8a74a" />
            <path d="M26 116 L28 121 M34 116 L32 121" />
          </g>
        );
      case 'laptop':
        return (
          <g {...common}>
            <rect x="21" y="110" width="18" height="12" rx="1.5" fill="#4f5b77" />
            <rect x="18" y="122" width="24" height="3" rx="1" fill="#9aa3b8" />
            <circle cx="30" cy="116" r="2.5" fill="#ff8fb1" stroke="none" />
          </g>
        );
      case 'mask':
        return (
          <g {...common}>
            <path d="M20 110 Q30 106 40 110 Q40 126 30 128 Q20 126 20 110 Z" fill="#ffe45c" />
            <circle cx="26" cy="115" r="1.8" fill={INK} />
            <circle cx="34" cy="115" r="1.8" fill={INK} />
            <path d="M25 120 Q30 125 35 120" fill="none" />
          </g>
        );
      case 'clapperboard':
        return (
          <g {...common}>
            <rect x="19" y="114" width="22" height="14" fill="#2b2a3a" />
            <path d="M19 108 L41 108 L41 114 L19 114 Z" fill="#ffffff" />
            <path
              d="M23 108 L21 114 M29 108 L27 114 M35 108 L33 114"
              stroke={INK}
              strokeWidth="2"
            />
          </g>
        );
    }
  })();
  return <g data-prop={prop}>{body}</g>;
}

function Touch({ touch }: { touch: UnisexTouch }): ReactNode {
  switch (touch) {
    case 'none':
      return null;
    case 'moustache':
      return (
        <path
          data-touch="moustache"
          d="M60 90 C 56 87 50 88 48 92 C 52 91 56 92 60 92 C 64 92 68 91 72 92 C 70 88 64 87 60 90 Z"
          fill={DARK}
        />
      );
    case 'bow':
      return (
        <g data-touch="bow" fill="#ff7ab6" stroke={INK} strokeWidth="1.4">
          <polygon points="80,32 72,26 72,38" />
          <polygon points="80,32 88,26 88,38" />
          <circle cx="80" cy="32" r="2.4" />
        </g>
      );
    case 'freckles':
      return (
        <g data-touch="freckles" fill="#a0522d">
          <circle cx="44" cy="74" r="2" />
          <circle cx="48" cy="78" r="2" />
          <circle cx="42" cy="79" r="2" />
          <circle cx="76" cy="74" r="2" />
          <circle cx="72" cy="78" r="2" />
          <circle cx="78" cy="79" r="2" />
        </g>
      );
  }
}

interface PipFigureProps {
  outfit: Outfit;
  touch: UnisexTouch;
  /** Draws the round frame he leans out of, with the outfit's tint inside it. */
  framed?: boolean;
  /** The subject prop: for bigger sizes (Home), not the small button. */
  showProp?: boolean;
  pose?: PipPose;
  className?: string;
}

export function PipFigure({
  outfit,
  touch,
  framed = false,
  showProp = false,
  pose = 'rest',
  className,
}: PipFigureProps) {
  const clipId = `${useId()}-pip-clip`;
  return (
    <svg
      className={['pip-figure', `pip-figure--${pose}`, className].filter(Boolean).join(' ')}
      viewBox="0 0 120 150"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Anything below the top of the ring stays inside it; above it, he leans out. */}
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="98" />
          <circle cx="60" cy="98" r="44" />
        </clipPath>
      </defs>
      {framed && (
        <>
          <circle data-layer="tint" cx="60" cy="98" r="44" fill={outfit.tint} />
          <path
            data-layer="ring-back"
            className="pip-figure__ring"
            d="M14 98 A46 46 0 0 1 106 98"
            fill="none"
          />
        </>
      )}
      <g clipPath={framed ? `url(#${clipId})` : undefined}>
        <g data-layer="body" className="pip-figure__body">
          <rect x="50" y="86" width="20" height="20" fill={ORANGE_SIDE} />
          <polygon points="34,100 60,98 60,150 18,150" fill={ORANGE} />
          <polygon points="60,98 86,100 102,150 60,150" fill={ORANGE_SIDE} />
          <polygon points="47,101 73,101 60,136" fill={CREAM} />
        </g>
        <g
          data-layer="arm"
          className="pip-figure__arm"
          style={{ transformOrigin: `${SHOULDER.x}px ${SHOULDER.y}px` }}
        >
          <path
            className="pip__upper-arm"
            d={`M${SHOULDER.x} ${SHOULDER.y} L96 130`}
            stroke={ORANGE_SIDE}
            strokeWidth="11"
            strokeLinecap="round"
          />
          <circle cx="97" cy="131" r="6.5" fill={ORANGE} stroke="#b8480f" strokeWidth="1.2" />
        </g>
        {showProp && outfit.prop && <Prop prop={outfit.prop} />}
        <g className="pip-figure__book">
          <polygon
            points="36,128 60,120 84,128 84,146 60,138 36,146"
            fill="#4f7cff"
            stroke={INK}
            strokeWidth="2"
          />
          <path d="M60 120 L60 138" stroke={INK} strokeWidth="2" />
        </g>
        {outfit.item && ['lab-collar', 'ruff', 'bow-tie'].includes(outfit.item) && (
          <Item item={outfit.item} />
        )}
      </g>
      <g data-layer="head" className="pip-figure__head">
        <polygon points={head('18,52 30,8 54,36')} fill={ORANGE} />
        <polygon points={head('102,52 90,8 66,36')} fill={ORANGE_SIDE} />
        <polygon points={head('27,42 31,20 45,35')} fill={DARK} />
        <polygon points={head('93,42 89,20 75,35')} fill={DARK} />
        <polygon points={head('18,52 54,36 60,36 60,106 32,82')} fill={ORANGE} />
        <polygon points={head('60,36 66,36 102,52 88,82 60,106')} fill={ORANGE_SIDE} />
        <polygon points={head('36,74 60,64 84,74 60,106')} fill={CREAM} />
        <g className="pip-figure__eyes">
          <polygon
            className="pip-figure__eye"
            points={head('40,58 47,52 52,59 45,63')}
            fill={DARK}
          />
          <polygon
            className="pip-figure__eye"
            points={head('80,58 73,52 68,59 75,63')}
            fill={DARK}
          />
        </g>
        <polygon points={head('53,90 67,90 60,98')} fill={DARK} />
        <Touch touch={touch} />
        {outfit.item && !['lab-collar', 'ruff', 'bow-tie'].includes(outfit.item) && (
          <Item item={outfit.item} />
        )}
        <g className="pip-figure__zzz" fill="#4f7cff" aria-hidden="true">
          <text x="86" y="30" fontSize="16" fontWeight="900">
            z
          </text>
          <text x="96" y="18" fontSize="12" fontWeight="900">
            z
          </text>
        </g>
      </g>
      <g className="pip-figure__timer">
        <circle cx="100" cy="70" r="10" fill="#ffffff" stroke={INK} strokeWidth="2" />
        <path
          d="M100 64 L100 70 L104 73"
          stroke={INK}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="97" y="57" width="6" height="3" fill={INK} />
      </g>
      <g className="pip-figure__stars" fill="#ffc83d" stroke={INK} strokeWidth="1.4">
        <path d="M16 34 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z" />
        <path d="M100 30 l2.4 5 5 .8 -3.6 3.4 .8 5 -4.6 -2.4 -4.6 2.4 .8 -5 -3.6 -3.4 5 -.8z" />
      </g>
      {framed && (
        <path
          data-layer="ring-front"
          className="pip-figure__ring"
          d="M106 98 A46 46 0 0 1 14 98"
          fill="none"
        />
      )}
    </svg>
  );
}
