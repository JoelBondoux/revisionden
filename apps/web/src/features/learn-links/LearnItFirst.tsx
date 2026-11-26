import { useId, useState } from 'react';
import { PROVIDER_NAMES, type LearnLink } from './links';
import './learn-links.css';

interface LinksProps {
  links: readonly LearnLink[];
}

/**
 * A button that opens a list of free lessons. Plain links that open in a new tab, so nothing is
 * loaded from those sites until the student taps one, and nothing is recorded about the tap.
 */
function LessonLinks({ links, label }: LinksProps & { label: string }) {
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
        {label}
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

/** "Learn it first" before a topic's lesson: the whole topic's free lessons. */
export function LearnItFirst({ links }: LinksProps) {
  return <LessonLinks links={links} label="Learn it first" />;
}

/** "Learn more" on Explain and after a wrong answer: the most specific free lessons. */
export function LearnMore({ links }: LinksProps) {
  return <LessonLinks links={links} label="Learn more" />;
}
