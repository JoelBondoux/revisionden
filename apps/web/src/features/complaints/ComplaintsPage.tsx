import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Pill, type PillTone } from '../../components/Pill';
import {
  ComplaintsApiError,
  defaultComplaintsApi,
  type Complaint,
  type ComplaintsApi,
} from './complaintsApi';
import '../feedback/feedback.css';

const STATUS: Record<Complaint['status'], { label: string; tone: PillTone }> = {
  new: { label: 'Received', tone: 'neutral' },
  acknowledged: { label: 'Being looked at', tone: 'primary' },
  escalated: { label: 'Being reviewed by a manager', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
};

const ukDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  }).format(new Date(iso));

const messageOf = (err: unknown) =>
  err instanceof ComplaintsApiError ? err.message : 'Something went wrong. Please try again.';

/**
 * "Make a complaint" (workstream O4, `docs/legal/complaints-policy.md`): a parent makes a formal
 * complaint and follows it here. Replies come from RevisionDen support, never named.
 */
export function ComplaintsPage({ api: given }: { api?: ComplaintsApi }) {
  const api = useMemo(() => given ?? defaultComplaintsApi(), [given]);
  const [list, setList] = useState<Complaint[] | 'loading' | 'failed'>('loading');
  const [summary, setSummary] = useState('');
  const [aboutPersonalData, setAboutPersonalData] = useState(false);
  const [sent, setSent] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setList(await api.list());
    } catch {
      setList('failed');
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      const result = await api.create({ summary: summary.trim(), aboutPersonalData });
      setSent(ukDay(result.acknowledgeDueAt));
      setSummary('');
      setAboutPersonalData(false);
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <div className="stack">
      <h1>Make a complaint</h1>
      <p>
        If something has gone wrong and you want a formal answer, tell us here. We reply within 2
        working days and aim to sort it out within 14 days. If it takes longer, we tell you why and
        when to expect an answer. Read our{' '}
        <Link to="/legal/complaints-policy">complaints policy</Link>.
      </p>
      <form className="stack" onSubmit={(e) => void send(e)}>
        <label className="field">
          What went wrong?
          <textarea
            className="field__input"
            value={summary}
            maxLength={500}
            rows={5}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
        <label className="feedback__toggle">
          <input
            type="checkbox"
            checked={aboutPersonalData}
            onChange={(e) => setAboutPersonalData(e.target.checked)}
          />
          This is about how we use personal data
        </label>
        <p className="secondary-text">
          Please leave out email addresses, phone numbers and your child&apos;s nickname.
        </p>
        <Button type="submit" disabled={summary.trim().length < 3}>
          Send complaint
        </Button>
        {error && <p role="alert">{error}</p>}
        {sent && <p role="status">Thank you. We&apos;ll reply by {sent}.</p>}
      </form>

      <h2>Your complaints</h2>
      {list === 'loading' && <p aria-live="polite">Loading…</p>}
      {list === 'failed' && (
        <p role="alert">
          We couldn&apos;t load your complaints.{' '}
          <Button onClick={() => void load()}>Try again</Button>
        </p>
      )}
      {Array.isArray(list) && list.length === 0 && <p>No complaints.</p>}
      {Array.isArray(list) && list.length > 0 && (
        <ul className="feedback-list">
          {list.map((item) => (
            <ComplaintItem key={item.id} item={item} api={api} onSent={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ComplaintItem({
  item,
  api,
  onSent,
}: {
  item: Complaint;
  api: ComplaintsApi;
  onSent: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const status = STATUS[item.status];

  const addMessage = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      await api.addMessage(item.id, text.trim());
      setText('');
      await onSent();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <li className="feedback-list__item">
      <div className="feedback-list__meta">
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="secondary-text">Sent {ukDay(item.receivedAt)}</span>
      </div>
      <p>{item.summary}</p>
      {item.status !== 'resolved' && (
        <p className="secondary-text">
          {item.acknowledgedAt
            ? `We aim to sort this out by ${ukDay(item.resolveDueAt)}.`
            : `We'll reply by ${ukDay(item.acknowledgeDueAt)}.`}
        </p>
      )}
      {item.messages.map((m, i) => (
        <div key={i} className="feedback__reply">
          <strong>{m.from === 'operator' ? 'Reply from RevisionDen' : 'You wrote'}</strong>
          <p>{m.body}</p>
        </div>
      ))}
      {item.outcome && (
        <div className="feedback__reply">
          <strong>Outcome</strong>
          <p>{item.outcome}</p>
        </div>
      )}
      {item.status === 'resolved' && item.aboutPersonalData && (
        <p className="secondary-text">
          If you are unhappy with how we handled your personal data, you can complain to the
          Information Commissioner&apos;s Office: <a href="https://ico.org.uk">ico.org.uk</a>.
        </p>
      )}
      {item.status !== 'resolved' && (
        <form className="stack" onSubmit={(e) => void addMessage(e)}>
          <label className="field">
            Add a message
            <textarea
              className="field__input"
              value={text}
              maxLength={5000}
              rows={2}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={text.trim().length === 0}>
            Send message
          </Button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </li>
  );
}
