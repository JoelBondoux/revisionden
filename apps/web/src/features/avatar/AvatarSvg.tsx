import type { ReactNode } from 'react';
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
}

/** The layered avatar, drawn from its code. Only shapes: never a photo. */
export function AvatarSvg({ code, label, size = 120 }: AvatarSvgProps) {
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
    >
      {layer(
        'backgroundColour',
        <rect width={120} height={120} fill={BACKGROUND[id('backgroundColour')]} />,
      )}
      {layer('pattern')}
      {layer('scene')}
      {layer(
        'hairColour',
        <>
          <g data-part="hair-back">{hair.back?.(paint)}</g>
          {layer('topColour', layer('top'))}
          {layer(
            'skin',
            <>
              <rect x={54} y={70} width={12} height={16} fill={paint.skin} />
              <polygon points={HEAD_POINTS} fill={paint.skin} />
              {SKIN_DETAILS[id('skin')]}
            </>,
          )}
          {layer('facialHair')}
          {layer('mouth')}
          {layer('eyes')}
          {layer('hairStyle', hair.front(paint))}
        </>,
      )}
      {layer('eyewear')}
      {layer('headwear')}
      {layer('heldItem')}
    </svg>
  );
}
