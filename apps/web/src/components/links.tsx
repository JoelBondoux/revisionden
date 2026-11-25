/**
 * Link components (workstream J7): navigation never looks like plain underlined text. Every one
 * renders a real link (router `Link` inside the app, `<a>` for outside addresses and email), so
 * screen readers, keyboard and middle-click all behave as links. See docs/GAME_FEEL.md "Links".
 */
import { useId, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './links.css';

type Destination =
  /** A route inside the app. */
  | { to: string; href?: never; newTab?: never }
  /** An outside address or a mailto: link. */
  | { href: string; to?: never; newTab?: boolean };

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>;

const NEW_TAB_TEXT = ' (opens in a new tab)';

/** Renders the right element for a destination; `newTab` adds safe rel and a spoken hint. */
function AnyLink({
  dest,
  className,
  children,
  ...rest
}: AnchorProps & { dest: Destination; children: ReactNode }) {
  if (dest.to !== undefined) {
    return (
      <Link to={dest.to} className={className} {...rest}>
        {children}
      </Link>
    );
  }
  const tab = dest.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a href={dest.href} className={className} {...tab} {...rest}>
      {children}
      {dest.newTab && <span className="visually-hidden">{NEW_TAB_TEXT}</span>}
    </a>
  );
}

const destOf = (p: { to?: string; href?: string; newTab?: boolean }): Destination =>
  p.to !== undefined ? { to: p.to } : { href: p.href!, newTab: p.newTab };

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export type LinkButtonVariant = 'primary' | 'secondary' | 'quiet';

type LinkButtonProps = AnchorProps &
  Destination & {
    variant?: LinkButtonVariant;
    icon?: ReactNode;
    block?: boolean;
    children: ReactNode;
  };

/** A link that looks like one of our chunky buttons, with an optional icon. */
export function LinkButton({
  to,
  href,
  newTab,
  variant = 'primary',
  icon,
  block = false,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <AnyLink
      dest={destOf({ to, href, newTab })}
      className={cx('btn', `btn--${variant}`, 'link-button', block && 'btn--block', className)}
      {...rest}
    >
      {icon && (
        <span className="link-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </AnyLink>
  );
}

type LinkTileProps = AnchorProps &
  Destination & {
    title: string;
    description?: string;
    icon?: ReactNode;
  };

/**
 * A tappable card for "go to X": icon, title, one-line description and a chevron. Its accessible
 * name is the title alone; the description is read as its description.
 */
export function LinkTile({
  to,
  href,
  newTab,
  title,
  description,
  icon,
  className,
  ...rest
}: LinkTileProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  return (
    <AnyLink
      dest={destOf({ to, href, newTab })}
      className={cx('link-tile', className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      {...rest}
    >
      {icon && (
        <span className="link-tile__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="link-tile__text">
        <span className="link-tile__title" id={titleId}>
          {title}
        </span>
        {description && (
          <span className="link-tile__description" id={descId}>
            {description}
          </span>
        )}
      </span>
      <svg
        className="link-tile__chevron"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points="9 5 16 12 9 19" />
      </svg>
    </AnyLink>
  );
}

type SimpleLinkProps = AnchorProps & Destination & { children: ReactNode };

/** A small pill-shaped link for use inside cards ("Details", "Change"). */
export function LinkChip({ to, href, newTab, className, children, ...rest }: SimpleLinkProps) {
  return (
    <AnyLink dest={destOf({ to, href, newTab })} className={cx('link-chip', className)} {...rest}>
      {children}
    </AnyLink>
  );
}

/**
 * A link inside a sentence or long prose (policies). Stays inline for readability, but is bold and
 * coloured with a soft bar under it, and underlines on hover: never plain underlined text.
 */
export function TextLink({ to, href, newTab, className, children, ...rest }: SimpleLinkProps) {
  return (
    <AnyLink dest={destOf({ to, href, newTab })} className={cx('text-link', className)} {...rest}>
      {children}
    </AnyLink>
  );
}
