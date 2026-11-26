import { useEffect, useState, type ReactNode } from 'react';
import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  decodeAvatar,
  type AvatarChoices,
  type AvatarLayer,
} from '@revisionden/core';
import {
  BACKGROUND,
  DRAWINGS,
  HAIR,
  HAIR_STYLES,
  HEAD_POINTS,
  SKIN,
  SKIN_DETAILS,
  TOP_COLOUR,
  type Paint,
} from './parts';
import type { AvatarMotion } from './motion';

/** Decodes a code, falling back to the default avatar when it is not valid. */
export function choicesFrom(code: string): AvatarChoices {
  try {
    return decodeAvatar(code);
  } catch {
    return DEFAULT_AVATAR;
  }
}

const itemId = (choices: AvatarChoices, layer: AvatarLayer) =>
  AVATAR_CATALOGUE[layer][choices[layer]]?.id ?? AVATAR_CATALOGUE[layer][0]!.id;

interface AvatarSvgProps {
  code: string;
  /** Spoken name; leave out for a decorative copy (for example inside a labelled button). */
  label?: string;
  size?: number;
  /** E9: how it moves (see motion.ts). Still by default, so small copies never move. */
  motion?: AvatarMotion;
  /** Changes for each reaction, so the same one plays again. */
  motionKey?: number;
  /** Stops the idle loop (questions, Test mode); reactions still play. */
  paused?: boolean;
}

/** True while the tab is hidden, so the idle loop does not run in the background. */
function usePageHidden(active: boolean) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!active) return;
    const update = () => setHidden(document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [active]);
  return active && hidden;
}

/**
 * The layered avatar, drawn from its code. Only shapes: never a photo. Layers sit in moving
 * parts (figure, head, eyes, mouth) so that anything worn rides along with what it sits on.
 */
export function AvatarSvg({
  code,
  label,
  size = 120,
  motion = 'still',
  motionKey = 0,
  paused = false,
}: AvatarSvgProps) {
  const hidden = usePageHidden(motion !== 'still');
  const choices = choicesFrom(code);
  const id = (layer: AvatarLayer) => itemId(choices, layer);
  const paint: Paint = {
    skin: SKIN[id('skin')] ?? SKIN['skin-1']!,
    hair: HAIR[id('hairColour')] ?? HAIR.black!,
    top: TOP_COLOUR[id('topColour')] ?? TOP_COLOUR.white!,
  };
  const layer = (name: AvatarLayer, children?: ReactNode) => (
    <g data-layer={name} data-item={id(name)}>
      {children ?? DRAWINGS[name]?.[id(name)]?.(paint)}
    </g>
  );
  const hair = HAIR_STYLES[id('hairStyle')] ?? HAIR_STYLES.short!;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="avatar-svg"
      data-motion={motion}
      data-paused={paused ? 'true' : undefined}
      data-hidden={hidden ? 'true' : undefined}
    >
      {layer(
        'backgroundColour',
        <rect width={120} height={120} fill={BACKGROUND[id('backgroundColour')]} />,
      )}
      {layer('pattern')}
      {layer('scene')}
      <g data-motion-part="figure" key={motionKey}>
        {/* Hair that hangs behind the body moves with the head but is drawn behind the top. */}
        <g data-motion-part="head-back">
          <g data-part="hair-back">{hair.back?.(paint)}</g>
        </g>
        {layer('topColour', layer('top'))}
        <g data-part="neck">
          <rect x={54} y={70} width={12} height={16} fill={paint.skin} />
        </g>
        <g data-motion-part="head">
          {layer(
            'hairColour',
            <>
              {layer(
                'skin',
                <>
                  <polygon points={HEAD_POINTS} fill={paint.skin} />
                  {SKIN_DETAILS[id('skin')]}
                </>,
              )}
              {layer('facialHair')}
              <g data-motion-part="mouth">{layer('mouth')}</g>
              <g data-motion-part="eyes">{layer('eyes')}</g>
              {layer('hairStyle', hair.front(paint))}
            </>,
          )}
          {layer('eyewear')}
          {layer('headwear')}
        </g>
        {layer('heldItem')}
      </g>
    </svg>
  );
}
