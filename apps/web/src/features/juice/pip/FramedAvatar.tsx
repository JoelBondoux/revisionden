import { useId } from 'react';
import { AvatarSvg } from '../../avatar/AvatarSvg';
import type { AvatarMotion } from '../../avatar/motion';
import './pip.css';

interface FramedAvatarProps {
  code: string;
  /** E9 motion; idle by default. Pass "still" for reduced motion. */
  motion?: AvatarMotion;
  motionKey?: number;
  paused?: boolean;
}

/**
 * The player's avatar in its own ring, mirroring Pip (J15b-2, owner sign-off of the all-themes
 * mockup): the back of the ring and the disc sit behind, the body is clipped to the disc while the
 * head leans out over the top, and the front of the ring sits in front. The avatar's own square
 * background is hidden (see pip.css); E9's motion groups are untouched. Decorative.
 */
export function FramedAvatar({ code, motion = 'idle', motionKey, paused }: FramedAvatarProps) {
  const clip = `framed-avatar-${useId().replace(/:/g, '')}`;
  return (
    <span className="framed-avatar" aria-hidden="true">
      <svg
        data-frame="back"
        className="framed-avatar__ring"
        viewBox="0 12 120 124"
        focusable="false"
      >
        <defs>
          {/* Everything above the disc's middle, plus the disc itself (bounding-box units, so it
              fits any size). */}
          <clipPath id={clip} clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="0.75" />
            <circle cx="0.5" cy="0.75" r="0.35" />
          </clipPath>
        </defs>
        <circle className="framed-avatar__disc" cx="60" cy="90" r="42" />
        <path className="framed-avatar__arc" d="M16 90 A44 44 0 0 1 104 90" />
      </svg>
      <span
        data-frame="figure"
        className="framed-avatar__figure"
        style={{ clipPath: `url(#${clip})` }}
      >
        <AvatarSvg code={code} motion={motion} motionKey={motionKey} paused={paused} />
      </span>
      <svg
        data-frame="front"
        className="framed-avatar__ring"
        viewBox="0 12 120 124"
        focusable="false"
      >
        <path className="framed-avatar__arc" d="M104 90 A44 44 0 0 1 16 90" />
      </svg>
    </span>
  );
}
