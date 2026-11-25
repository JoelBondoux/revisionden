/**
 * Avatar effects earned from rewards, drawn over the avatar (original art). The glitch effect
 * is the Bug Hunter track's step 12: offset colour slices, like a screen glitch.
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
