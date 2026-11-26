import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { rowScrollTarget } from './hscroll';

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

/** Scrolls a row sideways just far enough to show `item` whole, lined up on an item's edge. */
function bringIntoRow(track: HTMLElement, item: HTMLElement, smooth: boolean) {
  const children = Array.from(track.children) as HTMLElement[];
  const chosen = children.findIndex((child) => child === item || child.contains(item));
  if (chosen < 0) return;
  const origin = track.getBoundingClientRect().left - track.scrollLeft;
  const items = children.map((child) => {
    const box = child.getBoundingClientRect();
    return { start: box.left - origin, end: box.right - origin };
  });
  const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
  // Any space already added after the last item is not part of the row's own length.
  const added = parseFloat(track.style.getPropertyValue('--hscroll-extra-end')) || 0;
  const max = track.scrollWidth - track.clientWidth - added;
  const { left: target } = rowScrollTarget(items, chosen, {
    width: track.clientWidth,
    pad,
    current: track.scrollLeft,
    max,
  });
  // Near the end, a little space after the last item lets the row stop on a whole item.
  const extraEnd = Math.max(0, target - max);
  if (extraEnd > 0) track.style.setProperty('--hscroll-extra-end', `${extraEnd}px`);
  else track.style.removeProperty('--hscroll-extra-end');
  if (target === track.scrollLeft) return;
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
 * Items snap into place, a fade shows there is more, the chosen item is in view on load (the row
 * moves only as far as it must, so the first item you see is whole: J12d), focus brings an item into
 * view, and arrow buttons show on devices with a mouse or trackpad.
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

  /** True once the reader scrolls the row themselves: then it is never moved for them. */
  const touched = useRef(false);
  const showChosen = useCallback(() => {
    const el = track.current;
    const chosen = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && chosen) bringIntoRow(el, chosen, false);
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    touched.current = false;
    showChosen();
  }, [selectedKey, showChosen]);

  // The web font can arrive after the first layout and change every item's width; line the row
  // up again then, unless the reader has already scrolled it.
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fonts?.ready) return;
    let live = true;
    void fonts.ready.then(() => {
      if (live && !touched.current) showChosen();
    });
    return () => {
      live = false;
    };
  }, [selectedKey, showChosen]);

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
        onPointerDown={() => (touched.current = true)}
        onWheel={() => (touched.current = true)}
        onKeyDown={() => (touched.current = true)}
        onFocus={(event) => {
          const el = track.current;
          const item = event.target as HTMLElement;
          if (el && item !== el && el.contains(item)) bringIntoRow(el, item, true);
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
