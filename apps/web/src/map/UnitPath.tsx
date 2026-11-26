import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MapUnit, TopicMap } from '@revisionden/core';
import { Sheet } from '../components';
import { ButtonLink } from '../components/Button';
import { LockIcon } from '../components/icons';
import { HScroller } from './HScroller';
import {
  currentTopicId,
  currentUnitId,
  pathLayout,
  scrollTopToShow,
  unitIsLocked,
  type PathLayout,
} from './path';
import { ChallengeHex, TopicHex } from './TopicHex';

type OnLocked = (message: string) => void;

/** "Ratio, proportion and rates of change" → "Ratio": the badge shows the first words only. */
function shortTitle(title: string): string {
  return title.split(/,| and /)[0]!.trim();
}

function unitStatus(unit: MapUnit): string {
  return unitIsLocked(unit) ? 'coming soon' : `${unit.masteryPercent}% mastered`;
}

/** A small hexagon with the unit's mastery, or a padlock while it is locked. */
function UnitHex({ unit }: { unit: MapUnit }) {
  return (
    <span className="unit-badge__hex" aria-hidden="true">
      {/* The percentage is drawn by CSS, so the badge's visible text is only the unit's name. */}
      <span
        className="unit-badge__inner"
        data-percent={unitIsLocked(unit) ? undefined : `${unit.masteryPercent}%`}
      >
        {unitIsLocked(unit) && <LockIcon />}
      </span>
    </span>
  );
}

/** One unit on the path: its hexagon and short name; its full name and state are read out. */
function UnitBadge({
  unit,
  chosen,
  onChoose,
}: {
  unit: MapUnit;
  chosen: boolean;
  onChoose: () => void;
}) {
  const short = shortTitle(unit.title);
  return (
    <button
      type="button"
      className={`unit-badge${unitIsLocked(unit) ? ' unit-badge--locked' : ''}`}
      aria-pressed={chosen}
      aria-label={`${unit.title}, ${unitStatus(unit)}`}
      onClick={onChoose}
    >
      <UnitHex unit={unit} />
      <span className="unit-badge__name">{short}</span>
    </button>
  );
}

/** Measures where the path sits and how much room is left above the tab bar. */
function usePathLayout(region: React.RefObject<HTMLElement>, unitId: string): PathLayout {
  const [layout, setLayout] = useState<PathLayout>({ mode: 'flow' });
  const measure = useCallback(() => {
    const el = region.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nav = document.querySelector('.main-nav')?.getBoundingClientRect().height ?? 0;
    const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const next = pathLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      remPx: rootFont,
      regionTop: rect.top + window.scrollY,
      // The card's padding and edge below the path, and the tab bar.
      bottomInset: nav + rootFont * 1.25,
    });
    setLayout((now) =>
      now.mode === next.mode &&
      (next.mode === 'flow' || (now.mode === 'scroll' && now.maxHeight === next.maxHeight))
        ? now
        : next,
    );
  }, [region]);
  useLayoutEffect(() => {
    measure();
  }, [measure, unitId]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    // Parts above the path load later (the 5-a-day, the install row), so measure again whenever
    // the page changes size.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure]);
  return layout;
}

interface UnitCardProps {
  unit: MapUnit;
  missionLessonId?: string;
  savedScroll: number | undefined;
  onScrolled: (top: number) => void;
  onLocked: OnLocked;
}

/** The chosen unit: its mastery and every topic as a path that scrolls inside the card. */
function UnitCard({ unit, missionLessonId, savedScroll, onScrolled, onLocked }: UnitCardProps) {
  const headingId = useId();
  const region = useRef<HTMLDivElement>(null);
  const layout = usePathLayout(region, unit.id);
  const current = currentTopicId(unit, missionLessonId);
  const locked = unitIsLocked(unit);
  const scrolls = layout.mode === 'scroll';

  // On opening a unit: back to where the student left it, else the current topic in view.
  useLayoutEffect(() => {
    const el = region.current;
    if (!el || !scrolls) return;
    if (savedScroll !== undefined) {
      el.scrollTop = savedScroll;
      return;
    }
    const item = el.querySelector<HTMLElement>('[data-current]');
    if (item) {
      el.scrollTop = scrollTopToShow({
        itemTop: item.offsetTop,
        itemHeight: item.offsetHeight,
        viewHeight: el.clientHeight,
      });
    }
    // Only when the unit or the layout changes, not on every saved scroll position.
  }, [unit.id, scrolls]);

  return (
    <section className="unit-card" aria-labelledby={headingId}>
      <div className="unit-card__head">
        <h3 id={headingId} className="unit-card__title">
          {unit.title}
        </h3>
        <p className="unit-card__mastery">
          {locked ? 'Coming soon' : `${unit.masteryPercent}% mastered`}
        </p>
      </div>
      <div
        ref={region}
        className={`unit-path${scrolls ? '' : ' unit-path--flow'}`}
        role="region"
        aria-label={`${unit.title} topics`}
        tabIndex={scrolls ? 0 : undefined}
        style={scrolls ? { maxHeight: layout.maxHeight } : undefined}
        onScroll={(event) => onScrolled(event.currentTarget.scrollTop)}
      >
        {locked && (
          <p className="unit-card__locked">
            Questions for {unit.title} are on their way. It unlocks as soon as they&apos;re ready.
          </p>
        )}
        <ol className="unit-path__list">
          {unit.topics.map((topic, i) => {
            // The next mission's topic stands out with its own Go button (J15c).
            const next = missionLessonId !== undefined && topic.lessonId === missionLessonId;
            return (
              <li
                key={topic.id}
                className={`unit-path__step unit-path__step--${i % 2 ? 'out' : 'in'}${next ? ' unit-path__step--next' : ''}`}
                data-current={topic.id === current ? '' : undefined}
              >
                <TopicHex topic={topic} onLocked={onLocked} />
                {next && (
                  <ButtonLink
                    to={`/learn/topic/${topic.lessonId}`}
                    variant="gold"
                    className="map-go"
                    aria-label={`Go: ${topic.title}`}
                  >
                    Go
                  </ButtonLink>
                )}
              </li>
            );
          })}
          <li className="unit-path__step unit-path__step--challenge">
            <ChallengeHex unitTitle={unit.title} challenge={unit.challenge} onLocked={onLocked} />
          </li>
        </ol>
      </div>
    </section>
  );
}

/** Every unit with its progress, from "See all". Choosing one opens it on the path. */
function UnitsOverview({
  units,
  open,
  onClose,
  onChoose,
}: {
  units: readonly MapUnit[];
  open: boolean;
  onClose: () => void;
  onChoose: (id: string) => void;
}) {
  return (
    <Sheet open={open} title="All units" onClose={onClose}>
      <ul className="units-overview">
        {units.map((unit) => {
          const mastered = unit.topics.filter((t) => t.status === 'mastered').length;
          return (
            <li key={unit.id}>
              <button
                type="button"
                className="units-overview__item"
                onClick={() => onChoose(unit.id)}
              >
                <UnitHex unit={unit} />
                <span className="units-overview__text">
                  <span className="units-overview__name">{unit.title}</span>{' '}
                  <span className="units-overview__meta">
                    {unitIsLocked(unit)
                      ? 'Coming soon'
                      : `${mastered} of ${unit.topics.length} topics mastered`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/**
 * "Your path" (J12b, design C): a row of unit badges that scrolls sideways, and the chosen unit's
 * card with all of its topics on a path that scrolls inside the card. Each unit keeps its place.
 */
export function UnitPath({ map, onLocked }: { map: TopicMap; onLocked: OnLocked }) {
  const headingId = useId();
  const [chosen, setChosen] = useState(() => currentUnitId(map));
  const [showAll, setShowAll] = useState(false);
  const scrollByUnit = useRef(new Map<string, number>());
  const unit = map.units.find((u) => u.id === chosen) ?? map.units[0];
  const closeAll = useCallback(() => setShowAll(false), []);
  if (!unit) return null;

  return (
    <section className="map-path" aria-labelledby={headingId}>
      <div className="map-path__head">
        <h2 id={headingId} className="map-path__heading">
          Your path
        </h2>
        <p className="map-path__subject">
          {map.qualification} {map.subject}
        </p>
        <button
          type="button"
          className="map-path__see-all"
          aria-haspopup="dialog"
          aria-label="See all units"
          onClick={() => setShowAll(true)}
        >
          See all
        </button>
      </div>
      <HScroller label="Units" selectedKey={unit.id} className="map-path__units">
        {map.units.map((u) => (
          <UnitBadge
            key={u.id}
            unit={u}
            chosen={u.id === unit.id}
            onChoose={() => setChosen(u.id)}
          />
        ))}
      </HScroller>
      <UnitCard
        key={unit.id}
        unit={unit}
        missionLessonId={map.nextMission?.lessonId}
        savedScroll={scrollByUnit.current.get(unit.id)}
        onScrolled={(top) => scrollByUnit.current.set(unit.id, top)}
        onLocked={onLocked}
      />
      <UnitsOverview
        units={map.units}
        open={showAll}
        onClose={closeAll}
        onChoose={(id) => {
          setChosen(id);
          setShowAll(false);
        }}
      />
    </section>
  );
}
