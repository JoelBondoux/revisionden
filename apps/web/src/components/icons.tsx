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

/* Icons for link tiles (J7). Simple original line drawings in the same 24px style. */

export const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </Icon>
);

export const HeartIcon = () => (
  <Icon>
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.01" />
  </Icon>
);

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" />
  </Icon>
);

export const HomeIcon = () => (
  <Icon>
    <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" />
  </Icon>
);

export const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.8 3 2.6 3.5 5.2" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Icon>
);

export const ChatIcon = () => (
  <Icon>
    <path d="M4 5h16v11H9l-5 4z" />
  </Icon>
);

export const BellIcon = () => (
  <Icon>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" />
  </Icon>
);

export const GiftIcon = () => (
  <Icon>
    <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z" />
  </Icon>
);

export const PhoneIcon = () => (
  <Icon>
    <path d="M8 2.5h8v19H8zM11 18.5h2" />
  </Icon>
);

export const BugIcon = () => (
  <Icon>
    <path d="M8 9h8v6a4 4 0 0 1-8 0zM9.5 9a2.5 2.5 0 0 1 5 0M4 12h4M16 12h4M5 7l3 2.5M19 7l-3 2.5M5 18l3-2M19 18l-3-2" />
  </Icon>
);

export const IdeaIcon = () => (
  <Icon>
    <path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V17.5h7v-3.6A6 6 0 0 0 12 3z" />
  </Icon>
);

export const BackIcon = () => (
  <Icon>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const DocumentIcon = () => (
  <Icon>
    <path d="M6 2.5h8l4 4v15H6zM14 2.5v4h4M9 12h6M9 16h6" />
  </Icon>
);
