import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { FriendlyNotice } from './FriendlyNotice';
import { parseFriendlyNotice } from './friendlyNotice';
import { Markdown } from './Markdown';
import { usePolicyLibrary } from './PolicyLibraryContext';
import './legal.css';

/** The policy shown as cards and short parts (docs/LEGAL.md, "Friendly view"). */
export const FRIENDLY_NOTICE = 'privacy-for-young-people';

/** One policy: plain English first, then the full text (on the same page), then changes. */
export function PolicyPage() {
  const { name = '' } = useParams();
  const policy = usePolicyLibrary().get(name);
  if (!policy) return <NotFoundPage />;

  if (name === FRIENDLY_NOTICE) {
    return (
      <article className="policy policy--friendly stack">
        <p className="policy__back no-print">
          <Link to="/legal">All policies</Link>
        </p>
        <header>
          <h1>{policy.title}</h1>
          <p className="secondary-text">
            Version {policy.version} · Effective date: {policy.effectiveDate}
          </p>
        </header>
        <FriendlyNotice content={parseFriendlyNotice(policy)} />
        <section aria-labelledby="changes">
          <h2 id="changes">Changes</h2>
          <Markdown text={policy.changes} headingOffset={1} />
        </section>
        <p className="no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </p>
      </article>
    );
  }

  return (
    <article className="policy stack">
      <p className="policy__back no-print">
        <Link to="/legal">All policies</Link>
      </p>
      <header>
        <h1>{policy.title}</h1>
        <p className="secondary-text">
          Version {policy.version} · Effective date: {policy.effectiveDate}
        </p>
      </header>
      <section className="policy__summary" aria-labelledby="plain-english">
        <h2 id="plain-english">In plain English</h2>
        <Markdown text={policy.plainEnglish} headingOffset={1} />
        <p className="secondary-text">
          If this summary and the full text differ, the full text applies.
        </p>
      </section>
      <section aria-labelledby="full-text">
        <h2 id="full-text">Read the full text</h2>
        <Markdown text={policy.fullText} />
      </section>
      <section aria-labelledby="changes">
        <h2 id="changes">Changes</h2>
        <Markdown text={policy.changes} headingOffset={1} />
      </section>
      <p className="no-print">
        <Button variant="secondary" onClick={() => window.print()}>
          Print
        </Button>
      </p>
    </article>
  );
}

/** Every policy, with who it is for. Reachable without signing in. */
export function LegalIndexPage() {
  const policies = usePolicyLibrary().available();
  return (
    <div className="stack">
      <h1>Policies</h1>
      <p>How RevisionDen looks after your data, and the rules for using it.</p>
      <ul className="policy-list">
        {policies.map((p) => (
          <li key={p.name}>
            <Link to={`/legal/${p.name}`} className="policy-list__link">
              <span className="policy-list__title">{p.title}</span>
              <span className="secondary-text">{p.summary}</span>
            </Link>
            <span className="policy-list__audience">{p.audience}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
