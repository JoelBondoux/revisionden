import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'gold';

function classes(variant: ButtonVariant, block: boolean, extra?: string): string {
  return ['btn', `btn--${variant}`, block ? 'btn--block' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  children: ReactNode;
}

/** Chunky pill button with a 3D bottom edge that presses down. */
export function Button({
  variant = 'primary',
  block = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return <button type={type} className={classes(variant, block, className)} {...rest} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  block?: boolean;
}

/** A real link (for navigation) styled like a button. */
export function ButtonLink({
  variant = 'primary',
  block = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={classes(variant, block, className)} {...rest} />;
}
