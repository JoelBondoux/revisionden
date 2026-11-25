import type { IosDevice } from './install';

/** The Share icon as Safari draws it: a square with an arrow pointing up. */
export function ShareIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v12" />
      <polyline points="7 8 12 3 17 8" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}

/** The Add to Home Screen icon: a square with a plus. */
export function AddIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

const WHERE_SHARE: Record<IosDevice, string> = {
  iphone: 'at the bottom of Safari, or under the ••• button',
  ipad: 'at the top of Safari, next to the address bar',
};

const NAME: Record<IosDevice, string> = { iphone: 'iPhone', ipad: 'iPad' };

/** Share → Add to Home Screen, illustrated, for an iPhone or an iPad (Safari has no prompt). */
export function IosSteps({ device }: { device: IosDevice }) {
  return (
    <ol className="steps install-steps" aria-label={`Steps for ${NAME[device]}`}>
      <li>
        <span className="install-steps__icon">
          <ShareIcon />
        </span>
        <span>
          In Safari, tap the <strong>Share</strong> button ({WHERE_SHARE[device]}).
        </span>
      </li>
      <li>
        <span className="install-steps__icon">
          <AddIcon />
        </span>
        <span>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </span>
      </li>
      <li>
        <span className="install-steps__icon" aria-hidden="true">
          🦊
        </span>
        <span>
          Tap <strong>Add</strong>. Pip now lives on your Home Screen.
        </span>
      </li>
    </ol>
  );
}
