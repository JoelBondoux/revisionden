/** Pip, the RevisionDen mascot: an angular geometric fox. Decorative unless given a label. */
export type PipMood = 'happy' | 'cheer';

interface PipProps {
  size?: number;
  mood?: PipMood;
  label?: string;
}

export function Pip({ size = 96, mood = 'happy', label }: PipProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      className={`pip pip--${mood}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      focusable="false"
      {...a11y}
    >
      <polygon points="18,52 30,8 54,36" fill="#FF7A2F" />
      <polygon points="102,52 90,8 66,36" fill="#E35F17" />
      <polygon points="27,42 31,20 45,35" fill="#3A2622" />
      <polygon points="93,42 89,20 75,35" fill="#3A2622" />
      <polygon points="18,52 54,36 60,36 60,106 32,82" fill="#FF7A2F" />
      <polygon points="60,36 66,36 102,52 88,82 60,106" fill="#E35F17" />
      <polygon points="36,74 60,64 84,74 60,106" fill="#F7F3EE" />
      {mood === 'cheer' ? (
        <>
          <polyline points="38,60 45,54 52,60" fill="none" stroke="#3A2622" strokeWidth="4" />
          <polyline points="68,60 75,54 82,60" fill="none" stroke="#3A2622" strokeWidth="4" />
        </>
      ) : (
        <>
          <polygon points="40,58 47,52 52,59 45,63" fill="#3A2622" />
          <polygon points="80,58 73,52 68,59 75,63" fill="#3A2622" />
        </>
      )}
      <polygon points="53,90 67,90 60,98" fill="#3A2622" />
    </svg>
  );
}
