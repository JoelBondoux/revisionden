import { useId } from 'react';
import { BANDANA, BODY_ITEMS, HEAD_ITEMS, LOOK_ART, PROPS } from './art';
import { HATS, type FlagWash, type Outfit, type PipLook } from './outfits';
import './pip.css';

/**
 * Pip, the fox, drawn in code (J15b; v3 in J15b-2 from the owner-approved all-themes mockup).
 * A bigger head leans out over the top of his round frame; only his shoulders show below, clipped
 * to the disc. There is no arm. The subject prop sits in front of the ring so it reads at button
 * size, and a thin keyline keeps the ring readable on any disc (flag washes included).
 * Decorative: whatever holds Pip gives the name.
 */

export type PipPose = 'rest' | 'blink' | 'tilt' | 'ears' | 'look' | 'nod' | 'cheer' | 'hmm' | 'nap';

const ORANGE = '#FF7A2F';
const ORANGE_SIDE = '#E35F17';
const DARK = '#3A2622';
const CREAM = '#F7F3EE';

/** Disc centre and radius in the 120 × 130 frame. */
const CX = 60;
const CY = 74;
const R = 44;

function Flag({ flag, clip }: { flag: FlagWash; clip: string }) {
  const n = flag.colours.length;
  const size = (2 * R) / n;
  return (
    <g data-layer="flag" className="pip-figure__flag" clipPath={`url(#${clip})`}>
      {flag.colours.map((colour, i) =>
        flag.dir === 'vertical' ? (
          <rect
            key={i}
            x={CX - R + i * size}
            y={CY - R}
            width={size + 0.3}
            height={2 * R}
            fill={colour}
          />
        ) : (
          <rect
            key={i}
            x={CX - R}
            y={CY - R + i * size}
            width={2 * R}
            height={size + 0.3}
            fill={colour}
          />
        ),
      )}
    </g>
  );
}

interface PipFigureProps {
  outfit: Outfit;
  /** Today's gently-leaning look (see `lookFor`). */
  look: PipLook;
  pose?: PipPose;
  /** Hide the prop (very small copies). */
  hideProp?: boolean;
}

export function PipFigure({ outfit, look, pose = 'rest', hideProp = false }: PipFigureProps) {
  const id = useId().replace(/:/g, '');
  const frameClip = `pip-frame-${id}`;
  const discClip = `pip-disc-${id}`;
  const lookKey = `${look.family}${look.variant}`;
  const hatOn = outfit.item !== null && HATS.includes(outfit.item);
  // The beanie look becomes a bandana at the neck when Pip already wears a hat.
  const beanieUnderHat = lookKey === 'c1' && hatOn;
  const headItem = outfit.item ? HEAD_ITEMS[outfit.item] : null;
  const bodyItem = outfit.item ? BODY_ITEMS[outfit.item] : null;

  return (
    <svg
      viewBox="0 0 120 130"
      className={`pip-figure pip-figure--${pose}`}
      aria-hidden="true"
      focusable="false"
      data-look={lookKey}
    >
      <defs>
        <clipPath id={frameClip}>
          <rect x="0" y="0" width="120" height={CY} />
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        <clipPath id={discClip}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>
      <circle
        data-layer="disc"
        className="pip-figure__disc"
        cx={CX}
        cy={CY}
        r={R}
        fill={outfit.tint}
      />
      {outfit.flag && <Flag flag={outfit.flag} clip={discClip} />}
      <circle className="pip-figure__keyline" cx={CX} cy={CY} r={R - 1.4} fill="none" />
      <path
        data-layer="ring-back"
        className="pip-figure__ring"
        d="M14 74 A46 46 0 0 1 106 74"
        fill="none"
      />
      <g clipPath={`url(#${frameClip})`}>
        <g data-layer="shoulders" className="pip-figure__shoulders">
          <polygon points="30,98 60,96 60,132 10,132" fill={ORANGE} />
          <polygon points="60,96 90,98 110,132 60,132" fill={ORANGE_SIDE} />
          <polygon points="48,99 72,99 60,124" fill={CREAM} />
          <g className="pip-figure__outfit">
            {bodyItem}
            {beanieUnderHat && BANDANA}
          </g>
        </g>
      </g>
      <path className="pip-figure__keyline" d="M102.6 74 A42.6 42.6 0 0 1 17.4 74" fill="none" />
      <g data-layer="head" className="pip-figure__head">
        <g transform="translate(60 52) scale(.82) translate(-60 -57)">
          <g className="pip-figure__ear pip-figure__ear--left">
            <polygon points="18,52 30,8 54,36" fill={ORANGE} />
            <polygon points="27,42 31,20 45,35" fill={DARK} />
          </g>
          <g className="pip-figure__ear pip-figure__ear--right">
            <polygon points="102,52 90,8 66,36" fill={ORANGE_SIDE} />
            <polygon points="93,42 89,20 75,35" fill={DARK} />
          </g>
          <polygon points="18,52 54,36 60,36 60,106 32,82" fill={ORANGE} />
          <polygon points="60,36 66,36 102,52 88,82 60,106" fill={ORANGE_SIDE} />
          <polygon points="36,74 60,64 84,74 60,106" fill={CREAM} />
          <polygon className="pip-figure__eye" points="40,58 47,52 52,59 45,63" fill={DARK} />
          <polygon className="pip-figure__eye" points="80,58 73,52 68,59 75,63" fill={DARK} />
          <polygon points="53,90 67,90 60,98" fill={DARK} />
          <g className="pip-figure__outfit">
            {!beanieUnderHat && LOOK_ART[lookKey]}
            {headItem}
          </g>
        </g>
      </g>
      <path
        data-layer="ring-front"
        className="pip-figure__ring"
        d="M106 74 A46 46 0 0 1 14 74"
        fill="none"
      />
      {outfit.prop && !hideProp && (
        <g
          data-layer="prop"
          data-prop={outfit.prop}
          className="pip-figure__outfit pip-figure__prop"
        >
          <g transform="translate(88 104) scale(1.12) translate(-20 -108)">{PROPS[outfit.prop]}</g>
        </g>
      )}
    </svg>
  );
}
