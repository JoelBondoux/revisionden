import { useId } from 'react';
import { staggerDelay } from '@revisionden/core';
import { LinkChip } from '../../components';
import { CountUp } from './countUp';

/** A number the tile counts up to (K5), formatted the same way on every frame. */
export interface TileCount {
  value: number;
  format: (value: number) => string;
  decimals?: number;
}

/**
 * A headline number with a short note under it. With `count`, the number counts up once when
 * the tile first comes into view (`index` of `of` sets its small stagger); otherwise `value`
 * shows as it is ("–", "Not yet").
 */
export function Tile({
  label,
  value,
  count,
  index = 0,
  of = 1,
  onSettled,
  note,
}: {
  label: string;
  value?: string;
  count?: TileCount | null;
  index?: number;
  of?: number;
  onSettled?: () => void;
  note?: string | null;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="stat-tile">
      <span id={id} className="stat-tile__label">
        {label}
      </span>
      <span className="stat-tile__value">
        {count ? (
          <CountUp
            value={count.value}
            format={count.format}
            decimals={count.decimals}
            delayMs={staggerDelay(index, of)}
            onSettled={onSettled}
          />
        ) : (
          value
        )}
      </span>
      {note && <span className="stat-tile__note">{note}</span>}
    </div>
  );
}

/** An empty panel: a short line (with a link to set it up where there is one), never zeros. */
export function NotSetUp({
  text = 'Not set up yet',
  link,
}: {
  text?: string;
  link?: { to: string; label: string };
}) {
  return (
    <p className="secondary-text">
      {text}
      {link && (
        <>
          {' · '}
          <LinkChip to={link.to}>{link.label}</LinkChip>
        </>
      )}
    </p>
  );
}
