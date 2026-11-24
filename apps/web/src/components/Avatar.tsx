import { decodeAvatar } from '@revisionden/core';
import { AvatarSvg } from '../features/avatar/AvatarSvg';

/**
 * A student's avatar. A real avatar code (see packages/core avatar.ts) is drawn as the layered
 * avatar; anything else falls back to a coloured tile with the nickname's first letter, with a
 * colour that comes from the code so it stays stable.
 */
const backgrounds = ['#6C47F5', '#0B8457', '#B34F00', '#2B2B3A', '#8E1B1B', '#4B2BC9'];

function hash(code: string): number {
  let h = 0;
  for (const char of code) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

function isAvatarCode(code: string): boolean {
  try {
    decodeAvatar(code);
    return true;
  } catch {
    return false;
  }
}

interface AvatarProps {
  code: string;
  nickname: string;
  size?: number;
}

export function Avatar({ code, nickname, size = 48 }: AvatarProps) {
  const label = `${nickname}'s avatar`;
  if (isAvatarCode(code)) return <AvatarSvg code={code} label={label} size={size} />;
  const background = backgrounds[hash(code) % backgrounds.length];
  return (
    <span
      className="avatar"
      role="img"
      aria-label={label}
      style={{ backgroundColor: background, width: size, height: size, fontSize: size * 0.45 }}
    >
      <span aria-hidden="true">{nickname.charAt(0).toUpperCase()}</span>
    </span>
  );
}
