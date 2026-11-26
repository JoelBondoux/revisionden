import { LinkChip } from '../../components/links';

/** A small outline heart (original artwork), used for the Get help link. */
export function HeartIcon() {
  return (
    <svg
      className="help-heart"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Get help" with a small heart, for footers, headers and menus (a shared LinkChip). Tapping it
 * only opens the private Get help page; nothing is recorded.
 */
export function GetHelpLink({ to = '/help', className }: { to?: string; className?: string }) {
  return (
    <LinkChip to={to} className={['get-help-link', className ?? ''].filter(Boolean).join(' ')}>
      <HeartIcon />
      Get help
    </LinkChip>
  );
}
