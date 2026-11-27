import type { ComponentType } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAvatarMotion } from '../features/avatar/motion';
import { FramedAvatar } from '../features/juice/pip/FramedAvatar';
import { CardsIcon, HomeIcon, MapIcon, PapersIcon, PlanIcon, PersonIcon } from './icons';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType;
}

/*
 * UX-1 (owner approved the UX report, 2026-11-27): Home · Learn (the map) · Cards · Me. Plan and
 * Papers are only "Coming soon", so they stay out of the bar unless the build turns them on
 * (VITE_COMING_SOON_TABS=1); their pages still open by address.
 */
const comingSoonTabs: NavItem[] = [
  { to: '/plan', label: 'Plan', Icon: PlanIcon },
  { to: '/papers', label: 'Papers', Icon: PapersIcon },
];

/** The tabs before Me, with the coming-soon ones only when asked for. */
export function navItemsFor(showComingSoon: boolean): NavItem[] {
  return [
    { to: '/home', label: 'Home', Icon: HomeIcon },
    { to: '/map', label: 'Learn', Icon: MapIcon },
    { to: '/cards', label: 'Cards', Icon: CardsIcon },
    ...(showComingSoon ? comingSoonTabs : []),
  ];
}

export const navItems = navItemsFor(import.meta.env.VITE_COMING_SOON_TABS === '1');

interface BottomNavProps {
  /** Flashcards due today; shown as a badge on the Cards tab when above zero. */
  cardsDue?: number;
  /** The student's own avatar code, for the Me item; a neutral placeholder until there is one. */
  avatarCode?: string | null;
}

/** Main navigation: a bottom bar on phones, a side rail on tablets and desktops (via CSS). */
/** Me covers Settings and Progress (and anything under them): both live on the Me page. */
const isMePage = (pathname: string) => /^\/(settings|progress)(\/|$)/.test(pathname);

export function BottomNav({ cardsDue = 0, avatarCode }: BottomNavProps) {
  const { pathname } = useLocation();
  const meActive = isMePage(pathname);
  // J15b-2: the avatar idles in its ring (still with reduced motion).
  const { props: avatarMotion } = useAvatarMotion();
  return (
    <nav className="main-nav" aria-label="Main">
      <ul className="main-nav__list">
        {navItems.map(({ to, label, Icon }) => {
          const badge = to === '/cards' && cardsDue > 0 ? cardsDue : null;
          return (
            <li key={to}>
              <NavLink
                to={to}
                className="main-nav__link"
                aria-label={badge !== null ? `${label}, ${badge} due` : undefined}
              >
                {/* The label comes first in the page, so the name starts with it; CSS still shows
                    the icon (and its badge) first. */}
                <span>{label}</span>{' '}
                <span className="main-nav__icon">
                  <Icon />
                  {badge !== null && (
                    <span className="main-nav__badge" aria-hidden="true">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
              </NavLink>
            </li>
          );
        })}
        {/* Last (far right on phones, bottom of the rail): the student's own settings and
            personalisation, shown with their avatar (owner, 2026-11-26). Get help and My
            progress are there too, so Me is marked current on Settings and Progress. */}
        <li>
          <Link
            to="/settings"
            className="main-nav__link"
            aria-label="Me, settings and personalisation"
            aria-current={meActive ? 'page' : undefined}
          >
            <span>Me</span>{' '}
            <span className="main-nav__icon">
              {avatarCode ? (
                <span className="main-nav__avatar main-nav__avatar--framed">
                  <FramedAvatar
                    code={avatarCode}
                    motion={avatarMotion.motion}
                    motionKey={avatarMotion.motionKey}
                  />
                </span>
              ) : (
                <span className="main-nav__avatar main-nav__avatar--placeholder">
                  <PersonIcon />
                </span>
              )}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
