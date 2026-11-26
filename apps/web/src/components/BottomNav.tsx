import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { CardsIcon, MapIcon, PapersIcon, PlanIcon, ProgressIcon } from './icons';

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
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
];

interface BottomNavProps {
  /** Flashcards due today; shown as a badge on the Cards tab when above zero. */
  cardsDue?: number;
}

/** Main navigation: a bottom bar on phones, a side rail on tablets and desktops (via CSS). */
export function BottomNav({ cardsDue = 0 }: BottomNavProps) {
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
      </ul>
    </nav>
  );
}
