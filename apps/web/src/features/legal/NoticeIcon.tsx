import type { ReactNode } from 'react';

/**
 * Original line icons for the friendly young people's notice. Drawn here (no icon fonts or
 * third-party images), 32×32, stroked in currentColor so they follow the theme. Decorative: the
 * text next to each icon says the same thing.
 */
const ICONS: Record<string, ReactNode> = {
  // A masquerade mask: you use a nickname.
  mask: (
    <>
      <path d="M4 12c4-2 8-2 12 1 4-3 8-3 12-1-.5 6-3.5 9-7 9-2.5 0-3.8-1.6-5-3.5-1.2 1.9-2.5 3.5-5 3.5-3.5 0-6.5-3-7-9Z" />
      <circle cx="10.5" cy="15" r="1.8" />
      <circle cx="21.5" cy="15" r="1.8" />
    </>
  ),
  // A friendly robot with a closed eye: the AI never knows it is you.
  robot: (
    <>
      <rect x="7" y="10" width="18" height="14" rx="4" />
      <path d="M16 10V6M13 5h6M12 17h2M18.5 16.5l2 1.5-2 1.5" />
      <path d="M4 15v4M28 15v4" />
    </>
  ),
  // Two people, a grown-up and a young person: your parent can see your progress.
  family: (
    <>
      <circle cx="11" cy="9" r="3.5" />
      <circle cx="22" cy="12" r="2.8" />
      <path d="M4 26c0-5 3-8 7-8s7 3 7 8M17 26c.3-4 2.2-6.5 5-6.5s4.7 2.5 5 6.5" />
    </>
  ),
  // A camera with a small clock: photos are deleted within a day.
  camera: (
    <>
      <path d="M4 11h5l2-3h7l2 3h3a2 2 0 0 1 2 2v3M4 11v11a2 2 0 0 0 2 2h11" />
      <circle cx="13" cy="17" r="4" />
      <circle cx="24" cy="23" r="5" />
      <path d="M24 20.5V23l1.8 1.2" />
    </>
  ),
  // A raised hand: you can ask.
  hand: (
    <>
      <path d="M11 17V8.5a1.5 1.5 0 0 1 3 0V15M14 14V6.5a1.5 1.5 0 0 1 3 0V14M17 14V7.5a1.5 1.5 0 0 1 3 0V15M20 15v-4.5a1.5 1.5 0 0 1 3 0V19c0 4.5-3 8-7.5 8S8 24 6.5 20.5L5 17a1.6 1.6 0 0 1 2.8-1.5L11 19" />
    </>
  ),
  // A shield with a tick: we look after it, no adverts.
  shield: (
    <>
      <path d="M16 4 6 8v7c0 6.5 4.5 11 10 13 5.5-2 10-6.5 10-13V8L16 4Z" />
      <path d="m11.5 16 3 3 6-6.5" />
    </>
  ),
  // A small building: who runs RevisionDen.
  building: (
    <>
      <path d="M6 27V9l10-4 10 4v18M4 27h24" />
      <path d="M11 12h2M19 12h2M11 17h2M19 17h2M14 27v-5h4v5" />
    </>
  ),
  // A key: how your account works (passkeys).
  key: (
    <>
      <circle cx="11" cy="16" r="5" />
      <path d="M16 16h12M24 16v4M20 16v3" />
    </>
  ),
  // A folder: what we keep.
  folder: (
    <>
      <path d="M4 9a2 2 0 0 1 2-2h6l2 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
      <path d="M9 17h14M9 21h9" />
    </>
  ),
  // A circle with a line through it: what we never collect.
  ban: (
    <>
      <circle cx="16" cy="16" r="11" />
      <path d="m8.5 8.5 15 15" />
    </>
  ),
  // A target: why we use it.
  target: (
    <>
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="6" />
      <circle cx="16" cy="16" r="1.5" />
    </>
  ),
  // A path with steps getting higher: the app changes as you learn.
  steps: (
    <>
      <path d="M4 26h7v-6h7v-6h7V7" />
      <path d="m21 9 4-4 3 3" />
    </>
  ),
  // An eye: who can see your information.
  eye: (
    <>
      <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" />
      <circle cx="16" cy="16" r="4" />
    </>
  ),
  // A clock: how long we keep it.
  clock: (
    <>
      <circle cx="16" cy="16" r="11" />
      <path d="M16 9v7l5 3" />
    </>
  ),
  // Balance scales: your rights.
  scales: (
    <>
      <path d="M16 5v21M10 27h12M7 9h18" />
      <path d="m7 9-4 8a4 4 0 0 0 8 0L7 9ZM25 9l-4 8a4 4 0 0 0 8 0l-4-8Z" />
    </>
  ),
  // A speech bubble with an exclamation mark: if you're not happy.
  speech: (
    <>
      <path d="M5 8a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H13l-6 5v-5a2 2 0 0 1-2-2V8Z" />
      <path d="M16 9v6M16 18.5v.5" />
    </>
  ),
  // Circling arrows: changes.
  refresh: (
    <>
      <path d="M26 12a10.5 10.5 0 0 0-19-2M6 20a10.5 10.5 0 0 0 19 2" />
      <path d="M7 4v6h6M25 28v-6h-6" />
    </>
  ),
  // A sparkle: AI marking.
  sparkle: (
    <>
      <path d="M14 4c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z" />
      <path d="M24 20c.5 2.5 1.5 3.5 4 4-2.5.5-3.5 1.5-4 4-.5-2.5-1.5-3.5-4-4 2.5-.5 3.5-1.5 4-4Z" />
    </>
  ),
  // An "i" in a circle: the default.
  info: (
    <>
      <circle cx="16" cy="16" r="11" />
      <path d="M16 14v8M16 10v.5" />
    </>
  ),
  // A padlock: your information is kept safe.
  padlock: (
    <>
      <rect x="7" y="14" width="18" height="13" rx="3" />
      <path d="M11 14v-3a5 5 0 0 1 10 0v3M16 19v3" />
    </>
  ),
};

/** Icon names the notice file may use (`<!-- icon: name -->`). */
export const iconNames = Object.keys(ICONS);

export function NoticeIcon({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <svg
      className="notice-icon"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}
