/**
 * Placeholder avatar: a coloured tile with the nickname's first letter. The colour comes from
 * the avatar code so it stays stable. TODO(workstream E): draw the layered avatar from the code.
 */
const backgrounds = ['#6C47F5', '#0B8457', '#B34F00', '#2B2B3A', '#8E1B1B', '#4B2BC9'];

function hash(code: string): number {
  let h = 0;
  for (const char of code) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

interface AvatarProps {
  code: string;
  nickname: string;
  size?: number;
}

export function Avatar({ code, nickname, size = 48 }: AvatarProps) {
  const background = backgrounds[hash(code) % backgrounds.length];
  return (
    <span
      className="avatar"
      role="img"
      aria-label={`${nickname}'s avatar`}
      style={{ backgroundColor: background, width: size, height: size, fontSize: size * 0.45 }}
    >
      <span aria-hidden="true">{nickname.charAt(0).toUpperCase()}</span>
    </span>
  );
}
