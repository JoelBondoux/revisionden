import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { useBugButtonVisible } from './bugButtonContext';
import { FeedbackForm } from './FeedbackForm';
import './feedback.css';

/** Original bug drawing: a round body, head, antennae and three legs a side. */
export function BugIcon() {
  return (
    <svg
      className="icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="12" cy="14.5" rx="5" ry="6" />
      <path d="M9.5 8.8a2.5 2.5 0 015 0" />
      <path d="M12 9v11.5" />
      <path d="M10 6.5L8.5 4M14 6.5L15.5 4" />
      <path d="M7 12H4M7 15.5H3.5M7.5 18.5l-2.5 2M17 12h3M17 15.5h3.5M16.5 18.5l2.5 2" />
    </svg>
  );
}

/**
 * The small bug button in the corner of every screen (docs/PRODUCT_RULES.md, "Bug icon"). It
 * opens the bug report in a sheet with the current screen filled in. Hidden when switched off in
 * Settings, or while a screen asks (timed papers, Test mode questions).
 */
export function BugButton() {
  const visible = useBugButtonVisible();
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const close = useCallback(() => setOpenOn(null), []);

  // Following a link from the sheet (for example "See your feedback") closes it.
  const openedAt = useRef(pathname);
  useEffect(() => {
    if (openedAt.current !== pathname) setOpenOn(null);
    openedAt.current = pathname;
  }, [pathname]);

  if (!visible) return null;
  return (
    <>
      <button
        type="button"
        className="bug-button"
        aria-label="Report a bug"
        aria-haspopup="dialog"
        onClick={() => setOpenOn(pathname)}
      >
        <BugIcon />
      </button>
      <Sheet open={openOn !== null} title="Report a bug" onClose={close}>
        {openOn !== null && (
          <FeedbackForm initialKind="bug" route={openOn} variant="sheet" onClose={close} />
        )}
      </Sheet>
    </>
  );
}
