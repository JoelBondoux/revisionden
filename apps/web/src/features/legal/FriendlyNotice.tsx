import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pip } from '../../components/Pip';
import { Markdown } from './Markdown';
import { NoticeIcon } from './NoticeIcon';
import type { FriendlyNoticeContent } from './friendlyNotice';
import './friendlyNotice.css';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Slides an element in the first time it scrolls into view. Content is visible by default: the
 * effect only arms itself when the browser can observe scrolling and motion is allowed, so
 * nothing stays hidden in tests, in print or without JavaScript.
 */
export function Reveal({ as: Tag = 'div', className = '', children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'idle' | 'armed' | 'shown'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    setState('armed');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const motion = state === 'armed' ? ' reveal' : state === 'shown' ? ' reveal reveal--in' : '';
  return (
    <Tag ref={ref as never} className={`${className}${motion}`} {...rest}>
      {children}
    </Tag>
  );
}

export interface RevealProps {
  as?: 'div' | 'li' | 'section';
  className?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
}

/** Pip holding a padlock: "we keep your information safe". Decorative. */
export function PipWithPadlock() {
  return (
    <span className="friendly-notice__pip" aria-hidden="true">
      <Pip size={88} />
      <span className="friendly-notice__padlock">
        <NoticeIcon name="padlock" size={36} />
      </span>
    </span>
  );
}

/**
 * The young people's privacy notice as cards and short parts with "Read more" (docs/LEGAL.md,
 * "Friendly view"). Built from the same Markdown file as the legal text.
 */
export function FriendlyNotice({ content }: { content: FriendlyNoticeContent }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const allOpen = content.sections.length > 0 && open.size === content.sections.length;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(content.sections.map((s) => s.id)));

  return (
    <div className="friendly-notice">
      <div className="friendly-notice__intro">
        <PipWithPadlock />
        {content.intro && <Markdown text={content.intro} />}
      </div>

      {content.shortVersion.length > 0 && (
        <section className="friendly-notice__short" aria-labelledby="short-version">
          <h2 id="short-version">The short version</h2>
          <ul className="notice-cards" aria-labelledby="short-version">
            {content.shortVersion.map((card, i) => (
              <Reveal as="li" key={card.text} className={`notice-card notice-card--${i % 3}`}>
                <span className="notice-card__icon">
                  <NoticeIcon name={card.icon} />
                </span>
                <span className="notice-card__text">{card.text}</span>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <div className="friendly-notice__toolbar no-print">
        <button type="button" className="notice-toggle-all" onClick={toggleAll}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {content.sections.map((section) => {
        const isOpen = open.has(section.id);
        const headingId = `part-${section.id}`;
        const panelId = `more-${section.id}`;
        return (
          <Reveal as="section" key={section.id} className="notice-part" aria-labelledby={headingId}>
            <h2 id={headingId} className="notice-part__title">
              <span className="notice-part__icon">
                <NoticeIcon name={section.icon} size={28} />
              </span>
              {section.title}
            </h2>
            {section.keyPoints.length > 0 && (
              <ul className="notice-part__points">
                {section.keyPoints.map((point) => (
                  <li key={point}>
                    <Markdown text={point} />
                  </li>
                ))}
              </ul>
            )}
            {section.details &&
              (section.keyPoints.length > 0 ? (
                <>
                  <div
                    id={panelId}
                    className="notice-part__more"
                    data-notice-more=""
                    hidden={!isOpen}
                  >
                    <Markdown text={section.details} />
                  </div>
                  <button
                    type="button"
                    className="notice-part__toggle no-print"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(section.id)}
                  >
                    {isOpen ? 'Show less' : 'Read more'}
                    <span className="visually-hidden"> about {section.title}</span>
                  </button>
                </>
              ) : (
                <Markdown text={section.details} />
              ))}
          </Reveal>
        );
      })}

      <div className="friendly-notice__end">
        <span className="friendly-notice__wave" aria-hidden="true">
          <Pip size={72} mood="cheer" />
        </span>
        <p>That&apos;s everything. Thanks for reading!</p>
      </div>
    </div>
  );
}
