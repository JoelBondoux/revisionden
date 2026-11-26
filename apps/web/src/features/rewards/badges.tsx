/**
 * Badge art drawn in code (original art, Doodle Diary style: pencil-sketch lines on paper, a
 * slightly wobbly outline and a hand-coloured fill). Badges without art here show as words only.
 */
import type { ReactNode } from 'react';

const INK = '#3B3A36';
const PAPER = '#FFF8E7';

export const BADGE_ART: Record<string, ReactNode> = {
  // Founding Tester (R5): a doodled rosette with a star and a little flag planted on top, for
  // students who were there before 1.0.
  'founding-tester': (
    <g data-badge="founding-tester" strokeLinecap="round" strokeLinejoin="round">
      {/* Ribbon tails */}
      <path
        d="M44 74 L36 108 L48 100 L56 110 L60 78"
        fill="#7C5CFF"
        stroke={INK}
        strokeWidth={2.5}
      />
      <path
        d="M76 74 L84 108 L72 100 L64 110 L60 78"
        fill="#22B8CF"
        stroke={INK}
        strokeWidth={2.5}
      />
      {/* Wobbly rosette */}
      <path
        d="M60 14 C74 13 87 21 92 34 C98 47 95 62 86 71 C77 81 62 84 49 80 C35 76 25 64 24 50 C23 35 33 22 46 17 C51 15 55 14 60 14 Z"
        fill="#FFC83D"
        stroke={INK}
        strokeWidth={3}
      />
      <path
        d="M60 24 C71 24 81 31 83 42 C85 53 79 64 69 68 C59 72 47 69 40 61 C33 53 33 41 39 33 C44 27 52 24 60 24 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth={2}
        strokeDasharray="5 3"
      />
      {/* Star */}
      <path
        d="M60 33 L64 43 L75 44 L67 51 L69 62 L60 56 L51 62 L53 51 L45 44 L56 43 Z"
        fill="#FF8A3D"
        stroke={INK}
        strokeWidth={2}
      />
      {/* Little flag on top */}
      <path d="M60 14 L60 2" stroke={INK} strokeWidth={2.5} />
      <path d="M60 2 L72 5 L60 9" fill="#4CAF50" stroke={INK} strokeWidth={2} />
      {/* Pencil sparkle marks */}
      <path d="M18 30 l5 3 M16 44 l6 0 M102 30 l-5 3 M104 44 l-6 0" stroke={INK} strokeWidth={2} />
    </g>
  ),
};

/** A badge's art as a labelled image (120 × 120 box), or nothing when it has no art. */
export function RewardBadge({
  id,
  label,
  size = 72,
}: {
  id: string;
  label: string;
  size?: number;
}) {
  const art = BADGE_ART[id];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className="reward-badge"
    >
      {art}
    </svg>
  );
}
