import type { ComponentType } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AvatarSvg } from '../features/avatar/AvatarSvg';
import { CardsIcon, MapIcon, PapersIcon, PlanIcon, PersonIcon } from './icons';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType;
}

export const navItems: NavItem[] = [
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/cards', label: 'Cards', Icon: CardsIcon },
  { to: '/plan', label: 'Plan', Icon: PlanIcon },
  { to: '/papers', label: 'Papers', Icon: PapersIcon },
];

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
                <span className="main-nav__avatar">
                  <AvatarSvg code={avatarCode} size={28} />
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
