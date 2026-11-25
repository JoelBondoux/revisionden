import { useId, useState } from 'react';
import { PROVIDER_NAMES, type LearnLink } from './links';
import './learn-links.css';

/**
 * The "Learn it first" button: free official lessons for this topic. Plain links that open in a
 * new tab, so nothing is loaded from those sites until the student taps one.
 */
export function LearnItFirst({ links }: { links: readonly LearnLink[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (links.length === 0) return null;
  return (
    <div className="learn-first">
      <button
        type="button"
        className="learn-first__toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
      >
        Learn it first
      </button>
      {open && (
        <ul id={listId} className="learn-first__list">
          {links.map((link) => (
            <li key={link.url}>
              <a
                className="learn-first__link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="learn-first__title">{link.title}</span>
                <span className="learn-first__provider">
                  {PROVIDER_NAMES[link.provider]}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
