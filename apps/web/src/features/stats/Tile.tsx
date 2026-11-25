import { useId } from 'react';
import { LinkChip } from '../../components';

/** A headline number with a short note under it. */
export function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | null;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="stat-tile">
      <span id={id} className="stat-tile__label">
        {label}
      </span>
      <span className="stat-tile__value">{value}</span>
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
