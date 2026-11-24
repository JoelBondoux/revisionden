import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const LearnIcon = () => (
  <Icon>
    <path d="M3 9l9-5 9 5-9 5-9-5z" />
    <path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5" />
  </Icon>
);

export const CardsIcon = () => (
  <Icon>
    <rect x="3" y="6" width="13" height="15" rx="2.5" />
    <path d="M8 3h10.5A2.5 2.5 0 0121 5.5V17" />
  </Icon>
);

export const PlanIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const PapersIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 16h6" />
  </Icon>
);

export const ProgressIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const StarIcon = () => (
  <Icon>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  </Icon>
);

export const FlameIcon = () => (
  <Icon>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8z" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icon>
);

export const WrenchIcon = () => (
  <Icon>
    <path d="M14.5 6.5a4 4 0 015 5L12 19a2.1 2.1 0 01-3-3l7.5-7.5" />
    <path d="M14.5 6.5L17 9" />
  </Icon>
);

export const CrownIcon = () => (
  <Icon>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </Icon>
);

export const MapIcon = () => (
  <Icon>
    <path d="M12 2.5l4 2.3v4.6l-4 2.3-4-2.3V4.8z" />
    <path d="M7 11.5l4 2.3v4.6l-4 2.3-4-2.3v-4.6zM17 11.5l4 2.3v4.6l-4 2.3-4-2.3v-4.6z" />
  </Icon>
);
