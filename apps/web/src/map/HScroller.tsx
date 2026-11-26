import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

function Chevron({ direction }: { direction: 'before' | 'after' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={direction === 'before' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** True when the person asked for less motion (or the browser cannot say). */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/** Scrolls a row sideways so `item` sits in the middle, never past either end. */
function centreInRow(track: HTMLElement, item: HTMLElement, smooth: boolean) {
  const left = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
  const max = track.scrollWidth - track.clientWidth;
  const target = Math.max(0, Math.min(max, Math.round(left)));
  if (typeof track.scrollTo === 'function') {
    track.scrollTo({
      left: target,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  } else {
    track.scrollLeft = target;
  }
}

interface HScrollerProps {
  /** The group's name, read out with each item ("Subject", "Units"). */
  label: string;
  /** Changes when the chosen item changes, so it is brought into view. */
  selectedKey?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * A row that scrolls sideways when it is wider than the page (J12b): the page itself never does.
 * Items snap into place, a fade shows there is more, the chosen item is in view on load, focus
 * brings an item into view, and arrow buttons show on devices with a mouse or trackpad.
 */
export function HScroller({ label, selectedKey, className, children }: HScrollerProps) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useLayoutEffect(() => {
    const el = track.current;
    const chosen = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && chosen) centreInRow(el, chosen, false);
    measure();
  }, [selectedKey, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const step = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const by = direction * Math.max(120, el.clientWidth * 0.7);
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({ left: by, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } else {
      el.scrollLeft += by;
    }
  };

  return (
    <div
      className={['hscroll', className].filter(Boolean).join(' ')}
      data-more-before={edges.start ? undefined : ''}
      data-more-after={edges.end ? undefined : ''}
    >
      <button
        type="button"
        className="hscroll__arrow hscroll__arrow--before"
        tabIndex={-1}
        aria-label={`Scroll ${label.toLowerCase()} back`}
        hidden={edges.start}
        onClick={() => step(-1)}
      >
        <Chevron direction="before" />
      </button>
      <div
        ref={track}
        role="group"
        aria-label={label}
        className="hscroll__track"
        onScroll={measure}
        onFocus={(event) => {
          const el = track.current;
          const item = event.target as HTMLElement;
          if (el && item !== el && el.contains(item)) centreInRow(el, item, true);
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className="hscroll__arrow hscroll__arrow--after"
        tabIndex={-1}
        aria-label={`Scroll ${label.toLowerCase()} on`}
        hidden={edges.end}
        onClick={() => step(1)}
      >
        <Chevron direction="after" />
      </button>
    </div>
  );
}
