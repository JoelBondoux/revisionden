import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import {
  AVATAR_CATALOGUE,
  REWARDS,
  encodeAvatar,
  type AvatarItem,
  type AvatarLayer,
} from '@revisionden/core';
import { Button } from '../../components';
import { useReducedMotion } from '../juice';
import { AvatarSvg, choicesFrom } from './AvatarSvg';
import { AVATAR_TABS, isAvailable, itemLabel, shuffleAvatar } from './catalogue';
import { colourOf } from './parts';
import './avatar.css';

interface AvatarBuilderProps {
  code: string;
  nickname: string;
  earnedRewardIds?: readonly string[];
  onChange: (code: string) => void;
  /** Injected randomness for Shuffle (tests pass a fixed one). */
  random?: () => number;
}

const rewardName = (item: AvatarItem) =>
  REWARDS.find((r) => r.id === item.unlockedBy)?.name ?? item.unlockedBy;

/** The nearest ancestor that scrolls (a sheet, say), or null for the page itself. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * True once the builder has scrolled past `sentinel` (J9): the stage then shows a compact preview.
 * It watches the box that actually scrolls and compares with that box's top edge, so it works in
 * a sheet as well as on a page. The stage keeps its place in the flow, so the switch never moves
 * the options.
 */
function useCompact(sentinel: RefObject<HTMLElement | null>): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const top = entry.rootBounds?.top ?? 0;
        setCompact(!entry.isIntersecting && entry.boundingClientRect.top < top);
      },
      { root: scrollParent(el) },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinel]);
  return compact;
}

/**
 * Layered avatar builder: the preview stays in view (pinned on top on phones, on the left when
 * wide) while tabs of items scroll. Locked items show their reward; Shuffle picks unlocked ones.
 */
export function AvatarBuilder({
  code,
  nickname,
  earnedRewardIds = [],
  onChange,
  random = Math.random,
}: AvatarBuilderProps) {
  const [tabId, setTabId] = useState(AVATAR_TABS[0]!.id);
  const [changes, setChanges] = useState(0);
  const baseId = useId();
  const reduced = useReducedMotion();
  const sentinel = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabPicked = useRef(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const compact = useCompact(sentinel);
  const choices = choicesFrom(code);
  const tab = AVATAR_TABS.find((t) => t.id === tabId)!;

  const change = (next: string) => {
    setChanges((n) => n + 1);
    onChange(next);
  };
  const selectTab = (id: string) => {
    tabPicked.current = true;
    setTabId(id);
  };

  // After a tab is picked, bring the new panel's start into view: just below the pinned stage
  // when they are stacked (phones, the sheet), or level with its top when side by side.
  useEffect(() => {
    if (!tabPicked.current) return;
    tabPicked.current = false;
    const stageEl = stageRef.current;
    const stage = stageEl?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!stageEl || !stage || !panel || !panelRef.current) return;
    const sideBySide = stage.right <= panel.left;
    // A compact stage grows back once the page is near the top again; its bottom margin holds
    // exactly the height it will regain, so aim below the full-size stage.
    const regain = parseFloat(getComputedStyle(stageEl).marginBottom) || 0;
    const target = sideBySide ? stage.top : stage.bottom + regain;
    if (panel.top >= target) return;
    const scroller = scrollParent(panelRef.current) ?? window;
    scroller.scrollBy({ top: panel.top - target, behavior: reduced ? 'auto' : 'smooth' });
  }, [tabId, reduced]);

  const pick = (layer: AvatarLayer, index: number) =>
    change(encodeAvatar({ ...choices, [layer]: index }));

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const last = AVATAR_TABS.length - 1;
    const to = {
      ArrowRight: from === last ? 0 : from + 1,
      ArrowLeft: from === 0 ? last : from - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    selectTab(AVATAR_TABS[to]!.id);
    tabRefs.current[to]?.focus();
  };

  return (
    <div className="avatar-builder">
      <span ref={sentinel} className="avatar-builder__sentinel" aria-hidden="true" />
      <div className="avatar-builder__layout">
        <div
          ref={stageRef}
          className="avatar-builder__stage"
          data-compact={compact ? 'true' : undefined}
        >
          <div className="avatar-builder__preview">
            <div className="avatar-builder__figure">
              <span
                key={changes}
                className={`avatar-builder__figure-inner${changes > 0 && !reduced ? ' avatar-builder__pop' : ''}`}
              >
                <AvatarSvg code={code} label={`${nickname || 'Your'}'s avatar`} size={160} />
              </span>
            </div>
            <Button
              variant="secondary"
              onClick={() => change(encodeAvatar(shuffleAvatar(random, earnedRewardIds)))}
            >
              Shuffle
            </Button>
          </div>
          <div role="tablist" aria-label="Avatar parts" className="avatar-builder__tabs">
            {AVATAR_TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={t.id === tabId}
                aria-controls={`${baseId}-panel`}
                tabIndex={t.id === tabId ? 0 : -1}
                className="avatar-builder__tab"
                onClick={() => selectTab(t.id)}
                onKeyDown={(event) => moveTab(event, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div
          ref={panelRef}
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          className="avatar-builder__panel"
        >
          {tab.sections.map(({ layer, label }) => (
            <fieldset key={layer} className="avatar-builder__section">
              <legend>{label}</legend>
              <div className="avatar-builder__options">
                {AVATAR_CATALOGUE[layer].map((item, index) => {
                  const open = isAvailable(item, earnedRewardIds);
                  const name = itemLabel(item.id);
                  const swatch = colourOf(layer, item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`avatar-option${open ? '' : ' avatar-option--locked'}`}
                      aria-pressed={choices[layer] === index}
                      aria-disabled={open ? undefined : true}
                      onClick={() => open && pick(layer, index)}
                    >
                      {swatch ? (
                        <span
                          className="avatar-option__swatch"
                          style={{ backgroundColor: swatch }}
                          aria-hidden="true"
                        />
                      ) : (
                        <AvatarSvg code={encodeAvatar({ ...choices, [layer]: index })} size={56} />
                      )}
                      <span className="avatar-option__name">
                        {name}
                        {!open && <span className="visually-hidden">, locked. Unlock:</span>}
                      </span>
                      {!open && (
                        <span className="avatar-option__lock">
                          <span aria-hidden="true">🔒 </span>
                          {rewardName(item)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  );
}
