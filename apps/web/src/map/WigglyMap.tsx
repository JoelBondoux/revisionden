import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import type { MapTopic, MapUnit, TopicMap } from '@revisionden/core';
import { WrenchIcon } from '../components/icons';
import { useEffectStyle } from '../features/juice/styles';
import { outfitFor } from '../features/juice/pip/outfits';
import { PROPS } from '../features/juice/pip/art';
import { discoverNext, foundCount, takeFresh, type BridgeLink, type Bridges } from './bridges';
import { NODE_ART } from './nodeArt';
import { currentUnitId, unitIsLocked } from './path';
import {
  QUEST_KEY,
  layoutRoute,
  segmentPath,
  type Route,
  type RouteItem,
  type RoutePoint,
} from './route';
import './wiggly.css';
import './wiggly-styles.css';

type OnLocked = (message: string) => void;

/** How far (px) and how slowly (s) each style's path breathes. */
const BREATH: Readonly<Record<string, readonly [number, number]>> = {
  'doodle-diary': [3, 9],
  'sticker-book': [2.5, 10],
  'pop-burst': [3, 8],
  starlight: [4, 12],
  'comic-pop': [2, 8],
  'garden-grow': [3.5, 11],
  'pixel-arcade': [2, 10],
  'petal-glow': [4, 12],
  'turbo-drive': [2.5, 8],
  'rainbow-parade': [3, 10],
};

/** The path holds still with reduced motion, and in automated tests (so clicks find their target). */
function breathingAllowed(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  try {
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

function statusWords(topic: MapTopic): string {
  switch (topic.status) {
    case 'mastered':
      return 'mastered';
    case 'in-progress':
      return `${topic.mastery}% mastered`;
    case 'weak':
      return `weak, ${topic.mastery}% mastered`;
    case 'locked':
      return 'locked';
  }
}

/** Topics in specification order as route items: Higher-only topics branch off for Foundation. */
function routeItems(unit: MapUnit, foundation: boolean): RouteItem[] {
  return unit.topics.map((t, i, all) => {
    if (foundation && t.tier === 'higher') return { key: t.id, kind: 'higher' };
    const group = t.orderGroup;
    const paired =
      group !== undefined && (all[i - 1]?.orderGroup === group || all[i + 1]?.orderGroup === group);
    return paired ? { key: t.id, kind: 'either', group } : { key: t.id, kind: 'main' };
  });
}

const segmentsOf = (route: Route, kinds: string[], done?: (from: string, to: string) => boolean) =>
  route.segments.filter((s) => kinds.includes(s.kind) && (!done || done(s.from, s.to)));

/**
 * Where to scroll a unit's path so `target` opens in the middle of it. On a short phone (320 × 640)
 * the scroller runs on under the bottom nav, so the middle of the whole scroller put the current
 * topic behind the nav, and a tap on it opened the nav's Plan (W15). Then it is centred in the part
 * the pupil can see instead; everywhere else the path opens exactly as before.
 */
function placeInView(page: HTMLElement, target: HTMLElement): number {
  const centred = Math.max(0, target.offsetTop - page.clientHeight / 2);
  const top = page.getBoundingClientRect().top;
  const nav = document.querySelector('.main-nav')?.getBoundingClientRect();
  // The nav covers the path only as the phone's bottom bar, not as the side rail.
  const navTop = nav && nav.top > top ? nav.top : Infinity;
  const seen = Math.min(window.innerHeight, navTop) - top;
  const bottom = target.offsetTop - centred + target.offsetHeight;
  if (seen <= 0 || bottom <= seen) return centred;
  return Math.max(0, target.offsetTop - seen / 2);
}

/** The breathing path: nodes drift a few px on a slow sine and the road redraws to follow. */
function useBreathing(
  trail: React.RefObject<HTMLDivElement>,
  route: Route,
  active: boolean,
  styleId: string,
) {
  useEffect(() => {
    const el = trail.current;
    if (!el || !active || !breathingAllowed()) return;
    const [amp, period] = BREATH[styleId] ?? [3, 10];
    const offsets = new Map(route.points.map((p) => [p.key, { dx: 0, dy: 0 }]));
    let frame = 0;
    const tick = (t: number) => {
      route.points.forEach((p, i) => {
        const o = offsets.get(p.key)!;
        o.dx = amp * Math.sin((2 * Math.PI * t) / (period * 1000) + i * 0.9);
        o.dy = amp * 0.6 * Math.cos((2 * Math.PI * t) / (period * 1300) + i * 1.3);
        el.querySelectorAll<HTMLElement>(`[data-point="${CSS.escape(p.key)}"]`).forEach((n) => {
          n.style.translate = `${o.dx.toFixed(2)}px ${o.dy.toFixed(2)}px`;
        });
      });
      const width = el.clientWidth || 300;
      el.querySelectorAll<SVGPathElement>('path[data-segments]').forEach((path) => {
        const list = route.segments.filter((s) =>
          path.dataset.segments!.split(' ').includes(`${s.from}>${s.to}`),
        );
        path.setAttribute(
          'd',
          list
            .map((s) => {
              const a = route.points.find((p) => p.key === s.from)!;
              const b = route.points.find((p) => p.key === s.to)!;
              return segmentPath(
                { ...a, ...offsets.get(a.key)! },
                { ...b, ...offsets.get(b.key)! },
                { width, curl: s.curl, side: s.kind === 'bridge' },
              );
            })
            .join(' '),
        );
      });
      frame = requestAnimationFrame(tick); // pauses by itself while the tab is hidden
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trail, route, active, styleId]);
}

interface UnitRouteProps {
  map: TopicMap;
  unit: MapUnit;
  active: boolean;
  bridges: Bridges | undefined;
  onLocked: OnLocked;
  onSay: (message: string) => void;
}

/** One unit's winding path, climbing from its first topic at the bottom to the unit quest. */
function UnitRoute({ map, unit, active, bridges, onLocked, onSay }: UnitRouteProps) {
  const { styleId } = useEffectStyle();
  const trail = useRef<HTMLDivElement>(null);
  const [, setVersion] = useState(0);
  const foundation = /foundation/i.test(map.qualification);
  const mission = map.nextMission?.lessonId;
  const chainOf = (topicId: string) => bridges?.[topicId] ?? [];
  const counts = Object.fromEntries(
    unit.topics.map((t) => [t.id, Math.min(foundCount(t.id), chainOf(t.id).length)]),
  );
  const countsKey = JSON.stringify(counts);
  const route = useMemo(
    () =>
      layoutRoute({
        seed: `${map.subjectId ?? map.subject}:${unit.id}`,
        items: routeItems(unit, foundation),
        bridges: counts,
      }),
    [map.subjectId, map.subject, unit, foundation, countsKey],
  );
  useBreathing(trail, route, active, styleId);
  const art = NODE_ART[styleId] ?? NODE_ART['doodle-diary']!;
  const byId = new Map(unit.topics.map((t) => [t.id, t]));
  const isDone = (key: string) => byId.get(key)?.status === 'mastered';
  const isCurrent = (key: string) => byId.get(key)?.lessonId === mission;
  const doneSeg = (from: string, to: string) => isDone(from) && (isDone(to) || isCurrent(to));
  const width = 300;
  const pathFor = (
    kinds: string[],
    className: string,
    done?: (a: string, b: string) => boolean,
  ) => {
    const list = segmentsOf(route, kinds, done);
    const d = list
      .map((s) => {
        const a = route.points.find((p) => p.key === s.from)!;
        const b = route.points.find((p) => p.key === s.to)!;
        return segmentPath(
          { ...a, dx: 0, dy: 0 },
          { ...b, dx: 0, dy: 0 },
          { width, curl: s.curl, side: s.kind === 'bridge' },
        );
      })
      .join(' ');
    return (
      <path
        className={className}
        d={d}
        data-segments={list.map((s) => `${s.from}>${s.to}`).join(' ')}
      />
    );
  };

  // A discovery is celebrated once, the first time the map shows it.
  useEffect(() => {
    for (const p of route.points) {
      if (p.kind !== 'bridge') continue;
      const [topicId, index] = p.key.split('#') as [string, string];
      if (!takeFresh(p.key)) continue;
      const link = chainOf(topicId)[Number(index)];
      if (link) onSay(`You might find this ${link.subject} topic useful: ${link.topic}`);
    }
  }, [route]);

  const where = (p: RoutePoint) => ({ left: `${p.x}%`, top: `${p.y}px` });

  const node = (p: RoutePoint, i: number) => {
    if (p.kind === QUEST_KEY)
      return <Quest key={p.key} point={p} unit={unit} art={art.quest} onLocked={onLocked} />;
    if (p.kind === 'bridge') {
      const [topicId, index] = p.key.split('#') as [string, string];
      const link = chainOf(topicId)[Number(index)];
      if (!link) return null;
      return (
        <BridgeNode
          key={p.key}
          point={p}
          link={link}
          onTap={() => {
            onSay(`Practise this in ${link.subject}: ${link.why}.`);
            const chain = chainOf(topicId);
            // The next link of the chain appears a moment later, so the reason above is read first.
            if (foundCount(topicId) === Number(index) + 1 && chain.length > Number(index) + 1) {
              setTimeout(() => {
                if (discoverNext(topicId, chain.length)) setVersion((v) => v + 1);
              }, 600);
            }
          }}
        />
      );
    }
    const topic = byId.get(p.key)!;
    const current = topic.lessonId === mission;
    const higher = p.kind === 'higher';
    const name = `${topic.title}, ${higher ? 'optional Higher topic, ' : ''}${statusWords(topic)}${current ? ', you are here' : ''}`;
    const state = current
      ? 'current'
      : topic.status === 'mastered'
        ? 'done'
        : topic.status === 'locked'
          ? 'locked'
          : topic.status === 'weak'
            ? 'weak'
            : 'open';
    const className = `path-node path-node--${state}${higher ? ' path-node--higher' : ''}`;
    const body = higher ? (
      <span className="path-node__h">H</span>
    ) : state === 'done' ? (
      art.done[i % art.done.length]
    ) : state === 'current' ? (
      art.current
    ) : state === 'locked' ? (
      art.locked
    ) : state === 'weak' ? (
      <>
        <WrenchIcon />
        <span className="path-node__pct">{topic.mastery}%</span>
      </>
    ) : (
      <span className="path-node__pct">{topic.mastery}%</span>
    );
    const sub = higher
      ? 'Higher · optional'
      : p.kind === 'either' && state !== 'done'
        ? 'either order'
        : null;
    const label = (
      <span
        key={`${p.key}-label`}
        className="path-node__label"
        data-point={p.key}
        style={where(p)}
        aria-hidden="true"
      >
        {topic.title}
        {sub && <small>{sub}</small>}
      </span>
    );
    const tag = current ? (
      <span
        key={`${p.key}-here`}
        className={`path-here${p.x > 50 ? ' path-here--left' : ''}`}
        data-point={p.key}
        style={where(p)}
        aria-hidden="true"
      >
        You are here
      </span>
    ) : null;
    const button =
      topic.status === 'locked' ? (
        <button
          key={p.key}
          type="button"
          className={className}
          data-point={p.key}
          style={where(p)}
          aria-label={name}
          onClick={() => onLocked(`Finish the topics before ${topic.title} to unlock it.`)}
        >
          {body}
        </button>
      ) : (
        <Link
          key={p.key}
          to={`/learn/topic/${topic.lessonId}`}
          className={className}
          data-point={p.key}
          data-current={current ? '' : undefined}
          style={where(p)}
          aria-label={name}
          onClick={() => {
            // The first time a linked topic is opened, its first bridge is found (shown next visit).
            const chain = chainOf(topic.id);
            if (chain.length && foundCount(topic.id) === 0) discoverNext(topic.id, chain.length);
          }}
        >
          {body}
        </Link>
      );
    return [button, label, tag];
  };

  return (
    <div ref={trail} className="path-trail" style={{ height: route.height }}>
      <svg
        className="path-road"
        viewBox={`0 0 100 ${route.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {pathFor(['bridge'], 'rx')}
        {pathFor(['branch'], 'rb')}
        {pathFor(['main'], 're')}
        {pathFor(['main'], 'r')}
        {pathFor(['main'], 'rt')}
        {pathFor(['main'], 'd', doneSeg)}
        {pathFor(['main'], 'dd', doneSeg)}
      </svg>
      {route.points.map(node)}
    </div>
  );
}

function Quest({
  point,
  unit,
  art,
  onLocked,
}: {
  point: RoutePoint;
  unit: MapUnit;
  art: React.ReactNode;
  onLocked: OnLocked;
}) {
  const { challenge } = unit;
  const style = { left: `${point.x}%`, top: `${point.y}px` };
  const label = (
    <span className="path-node__label" data-point={point.key} style={style} aria-hidden="true">
      Challenge
    </span>
  );
  return challenge.unlocked ? (
    <>
      <Link
        to={`/learn/topic/${challenge.lessonId}`}
        className="path-node path-node--quest"
        data-point={point.key}
        style={style}
        aria-label={`Challenge for ${unit.title}`}
      >
        {art}
      </Link>
      {label}
    </>
  ) : (
    <>
      <button
        type="button"
        className="path-node path-node--quest path-node--locked"
        data-point={point.key}
        style={style}
        aria-label={`Challenge, unlocks at ${challenge.unlockAtPercent}% mastered in ${unit.title}`}
        onClick={() =>
          onLocked(
            `Reach ${challenge.unlockAtPercent}% mastery in ${unit.title} to unlock the challenge.`,
          )
        }
      >
        {art}
      </button>
      {label}
    </>
  );
}

function BridgeNode({
  point,
  link,
  onTap,
}: {
  point: RoutePoint;
  link: BridgeLink;
  onTap: () => void;
}) {
  const outfit = outfitFor(link.subjectId);
  const style = {
    left: `${point.x}%`,
    top: `${point.y}px`,
    '--tint': outfit.tint,
  } as React.CSSProperties;
  return (
    <>
      <button
        type="button"
        className="path-node path-node--bridge"
        data-point={point.key}
        style={style}
        aria-label={`${link.topic}, optional ${link.subject} topic`}
        onClick={onTap}
      >
        {outfit.prop && (
          <svg viewBox="0 88 40 40" aria-hidden="true" focusable="false">
            {PROPS[outfit.prop]}
          </svg>
        )}
      </button>
      <span
        className="path-node__label"
        data-point={point.key}
        style={{ left: `${point.x}%`, top: `${point.y}px` }}
        aria-hidden="true"
      >
        <small>From {link.subject} · optional</small>
        {link.topic}
      </span>
    </>
  );
}

/**
 * The topic map's units (J15c, owner sign-off of the all-themes mockup, revision 5): one unit at a
 * time on a winding path; swipe sideways, use the arrows or the arrow keys for the next unit.
 */
export function WigglyMap({
  map,
  onLocked,
  bridges,
}: {
  map: TopicMap;
  onLocked: OnLocked;
  bridges?: Bridges;
}) {
  const headingId = useId();
  const pager = useRef<HTMLDivElement>(null);
  const start = Math.max(
    0,
    map.units.findIndex((u) => u.id === currentUnitId(map)),
  );
  const [index, setIndex] = useState(start);
  const [said, setSaid] = useState<string | null>(null);
  const unit = map.units[index];

  const go = useCallback(
    (next: number) => {
      const i = Math.max(0, Math.min(map.units.length - 1, next));
      setIndex(i);
      const el = pager.current;
      if (el) {
        if (typeof el.scrollTo === 'function')
          el.scrollTo({
            left: i * el.clientWidth,
            behavior: breathingAllowed() ? 'smooth' : 'auto',
          });
        else el.scrollLeft = i * el.clientWidth;
      }
    },
    [map.units.length],
  );

  // Open on the current unit. Every unit's path starts at its next topic (done topics below it):
  // the current topic, else the lowest topic you can do, else the bottom. Placed once, so each
  // unit keeps where you left it when you come back (Codex review of #307).
  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    el.scrollLeft = start * el.clientWidth;
    for (const child of Array.from(el.children)) {
      const page = child as HTMLElement;
      const available = Array.from(
        page.querySelectorAll<HTMLElement>('.path-node--open, .path-node--weak'),
      ).sort((a, b) => b.offsetTop - a.offsetTop);
      const target = page.querySelector<HTMLElement>('[data-current]') ?? available[0];
      page.scrollTop = target ? placeInView(page, target) : page.scrollHeight;
    }
  }, [start]);

  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  const onScroll = () => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = pager.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== index) setIndex(i);
    }, 90);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  };
  if (!unit) return null;

  return (
    <section className="wiggly-map" aria-label="Your path">
      <div className="wiggly-map__head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous unit"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="wiggly-map__title">
          <h2 id={headingId} aria-live="polite">
            {unit.title}
          </h2>
          <p>{unitIsLocked(unit) ? 'Coming soon' : `${unit.masteryPercent}% mastered`}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next unit"
          disabled={index === map.units.length - 1}
          onClick={() => go(index + 1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="wiggly-map__dots" aria-hidden="true">
        {map.units.map((u, i) => (
          <i key={u.id} className={i === index ? 'on' : undefined} />
        ))}
      </div>
      <div
        ref={pager}
        className="wiggly-map__pager"
        role="group"
        aria-label="Units"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKey}
      >
        {map.units.map((u, i) => (
          <section key={u.id} className="wiggly-map__page" role="region" aria-label={u.title}>
            {unitIsLocked(u) && (
              <p className="wiggly-map__locked">
                Questions for {u.title} are on their way. It unlocks as soon as they&apos;re ready.
              </p>
            )}
            {!unitIsLocked(u) && <p className="visually-hidden">{u.masteryPercent}% mastered</p>}
            <UnitRoute
              map={map}
              unit={u}
              active={i === index}
              bridges={bridges}
              onLocked={onLocked}
              onSay={setSaid}
            />
          </section>
        ))}
      </div>
      {said && (
        <p className="map-discovery" role="status">
          {said}
        </p>
      )}
    </section>
  );
}
