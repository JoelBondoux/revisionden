import { useId, type ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  const headingId = useId();
  return (
    <section
      className={['card', className ?? ''].filter(Boolean).join(' ')}
      aria-labelledby={title ? headingId : undefined}
    >
      {title && (
        <h2 id={headingId} className="card__title">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
