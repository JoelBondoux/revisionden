import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PipWithPadlock, Reveal } from './FriendlyNotice';
import { Markdown } from './Markdown';
import { NoticeIcon } from './NoticeIcon';
import { parseAcceptanceSummary } from './acceptanceSummary';
import './friendlyNotice.css';
import './legal.css';

export interface PolicyToAccept {
  name: string;
  title: string;
  plainEnglish: string;
  fullText: string;
}

const POLICY_ICON: Record<string, string> = {
  'terms-of-use': 'scales',
  'privacy-notice': 'shield',
};

/** One policy: its plain-English points as cards, the full text behind "Show the details". */
function PolicySummary({ policy }: { policy: PolicyToAccept }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const headingId = `${id}-title`;
  const panelId = `${id}-details`;
  const { intro, points } = parseAcceptanceSummary(policy.plainEnglish);
  return (
    <Reveal as="section" className="notice-part accept-policy" aria-labelledby={headingId}>
      <h2 id={headingId} className="notice-part__title">
        <span className="notice-part__icon">
          <NoticeIcon name={POLICY_ICON[policy.name] ?? 'info'} size={28} />
        </span>
        {policy.title}
      </h2>
      {intro && <Markdown text={intro} />}
      <ul className="notice-cards accept-cards" aria-label={`${policy.title} in short`}>
        {points.map((point, i) => (
          <li key={point.text} className={`notice-card notice-card--${i % 3} accept-card`}>
            <span className="notice-card__icon">
              <NoticeIcon name={point.icon} />
            </span>
            <div className="accept-card__text">
              {point.label && <strong className="accept-card__label">{point.label}</strong>}
              <Markdown text={point.text} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="notice-part__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide the details' : 'Show the details'}
        <span className="visually-hidden"> of the {policy.title}</span>
      </button>
      <div id={panelId} className="notice-part__more" data-notice-more="" hidden={!open}>
        <Markdown text={policy.fullText} />
      </div>
      <p className="accept-policy__link">
        <Link to={`/legal/${policy.name}`}>Read the full {policy.title}</Link>
      </p>
    </Reveal>
  );
}

/**
 * The first step for a new parent (docs/LEGAL.md): the terms and privacy notice in plain
 * English, built from the policy files themselves, then the confirmation checkbox.
 */
export function BeforeYouStart(props: {
  policies: PolicyToAccept[];
  ticked: boolean;
  onTick: (ticked: boolean) => void;
  error?: string;
  onContinue: () => void;
}) {
  const { policies, ticked, onTick, error, onContinue } = props;
  return (
    <div className="friendly-notice accept">
      <div className="friendly-notice__intro">
        <PipWithPadlock />
        <div className="stack">
          <h1>Before you start</h1>
          <p>
            Please read how RevisionDen works and how we look after your family&apos;s data. Both
            start with a short summary in plain English.
          </p>
        </div>
      </div>
      {policies.map((policy) => (
        <PolicySummary key={policy.name} policy={policy} />
      ))}
      <Card>
        <label className="legal-check">
          <input type="checkbox" checked={ticked} onChange={(e) => onTick(e.target.checked)} />
          <span>
            I have read the <Link to="/legal/terms-of-use">Terms of use</Link> and{' '}
            <Link to="/legal/privacy-notice">Privacy notice</Link>
          </span>
        </label>
      </Card>
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
      <Button block disabled={!ticked} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
