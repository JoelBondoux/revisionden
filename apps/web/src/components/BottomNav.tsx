import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { CardsIcon, LearnIcon, PapersIcon, PlanIcon, ProgressIcon } from './icons';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType;
}

export const navItems: NavItem[] = [
  { to: '/learn', label: 'Learn', Icon: LearnIcon },
  { to: '/cards', label: 'Cards', Icon: CardsIcon },
  { to: '/plan', label: 'Plan', Icon: PlanIcon },
  { to: '/papers', label: 'Papers', Icon: PapersIcon },
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
];

/** Main navigation: a bottom bar on phones, a side rail on tablets and desktops (via CSS). */
export function BottomNav() {
  return (
    <nav className="main-nav" aria-label="Main">
      <ul className="main-nav__list">
        {navItems.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink to={to} className="main-nav__link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
