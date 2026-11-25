/**
 * Avatar effects earned from rewards, drawn over the avatar (original art). The glitch effect
 * is the Bug Hunter track's step 12: offset colour slices, like a screen glitch. Embers
 * (Comeback Kid), pace stripes (Pace Setter) and prism (Perfectionist) come from R7b.
 */
import type { ReactNode } from 'react';

export const EFFECTS: Record<string, ReactNode> = {
  glitch: (
    <g data-effect="glitch" opacity={0.55}>
      <rect x={0} y={34} width={120} height={6} fill="#FF2E88" transform="translate(-4 0)" />
      <rect x={0} y={58} width={120} height={4} fill="#22D3EE" transform="translate(5 0)" />
      <rect x={0} y={82} width={120} height={5} fill="#FF2E88" transform="translate(3 0)" />
      <rect x={0} y={100} width={120} height={3} fill="#22D3EE" transform="translate(-6 0)" />
    </g>
  ),
  // Comeback Kid: warm sparks rising from below.
  embers: (
    <g data-effect="embers">
      {[
        [24, 104, 3],
        [40, 92, 2],
        [86, 98, 3],
        [98, 84, 2],
        [66, 110, 2],
        [16, 80, 2],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FF8A3D" opacity={0.8} />
      ))}
    </g>
  ),
  // Pace Setter: speed lines streaking past on one side.
  'pace-stripes': (
    <g
      data-effect="pace-stripes"
      stroke="#22D3EE"
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.7}
    >
      <path d="M4 48 H26" />
      <path d="M10 62 H30" />
      <path d="M2 76 H24" />
    </g>
  ),
  // Perfectionist: a soft rainbow glint across the corner.
  prism: (
    <g data-effect="prism" opacity={0.45}>
      {['#FF5E5E', '#FFC83D', '#4CAF50', '#22D3EE', '#7C5CFF'].map((colour, i) => (
        <path
          key={colour}
          d={`M${84 + i * 6} 0 L${120} ${36 - i * 6}`}
          stroke={colour}
          strokeWidth={4}
        />
      ))}
    </g>
  ),
};

/** An effect layer to draw on top of an avatar SVG (same 120 × 120 box). */
export function AvatarEffect({ id, size = 120 }: { id: string; size?: number }) {
  const art = EFFECTS[id];
  if (!art) return null;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="avatar-effect">
      {art}
    </svg>
  );
}
