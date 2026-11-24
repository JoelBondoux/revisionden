import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'gold' | 'streak';

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

export function Pill({ tone = 'neutral', children }: PillProps) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
