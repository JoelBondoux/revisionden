import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Pill, type PillTone } from '../../components/Pill';
import { NotFoundPage } from '../../pages/NotFoundPage';
import {
  FEEDBACK_STATUSES,
  FeedbackApiError,
  KIND_LABELS,
  STATUS_LABELS,
  useFeedbackApi,
  type Feedback,
  type FeedbackStatus,
  type TriageFeedback,
} from './feedbackApi';
import './feedback.css';

type Load<T> =
  { state: 'loading' } | { state: 'ready'; data: T } | { state: 'failed'; error: unknown };

function useLoad<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' });
  const run = useCallback(() => {
    setResult({ state: 'loading' });
    load().then(
      (data) => setResult({ state: 'ready', data }),
      (error: unknown) => setResult({ state: 'failed', error }),
    );
  }, [load]);
  useEffect(run, [run]);
  return { result, retry: run };
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_TONES: Record<FeedbackStatus, PillTone> = {
  new: 'neutral',
  looking_into_it: 'primary',
  fixed: 'success',
  will_not_fix: 'neutral',
};

function Failed({ retry }: { retry: () => void }) {
  return (
    <div className="stack">
      <p role="alert" className="field__error">
        Could not load the feedback.
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}

function sender(item: Feedback, scope: 'family' | 'mine') {
  if (scope === 'mine') return 'From you';
  if (item.senderRole === 'parent') return 'From you';
  return `From ${item.studentNickname ?? 'a student'}`;
}

/** The family's feedback (parent) or a student's own, with its status. */
export function FeedbackListPage({ scope }: { scope: 'family' | 'mine' }) {
  const api = useFeedbackApi();
  const load = useCallback(
    () => (scope === 'family' ? api.listFamily() : api.listOwn()),
    [api, scope],
  );
  const { result, retry } = useLoad(load);

  return (
    <div className="stack">
      <h1>{scope === 'family' ? "Your family's feedback" : 'Your feedback'}</h1>
      {result.state === 'loading' && <p aria-live="polite">Loading…</p>}
      {result.state === 'failed' && <Failed retry={retry} />}
      {result.state === 'ready' &&
        (result.data.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          <ul className="feedback-list">
            {result.data.map((item) => (
              <li key={item.id} className="feedback-list__item">
                <div className="feedback-list__meta">
                  <strong>{KIND_LABELS[item.kind]}</strong>
                  <Pill tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Pill>
                </div>
                <p>{item.text ?? <span className="secondary-text">No message</span>}</p>
                <p className="secondary-text">
                  {sender(item, scope)} · {date(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ))}
      <Link to="/feedback">Send feedback</Link>
    </div>
  );
}

function TriageRow({ item }: { item: TriageFeedback }) {
  const api = useFeedbackApi();
  const [status, setStatus] = useState(item.status);
  const [saved, setSaved] = useState<'saved' | 'failed'>();

  const change = async (next: FeedbackStatus) => {
    setStatus(next);
    setSaved(undefined);
    try {
      await api.setStatus(item.id, next);
      setSaved('saved');
    } catch {
      setSaved('failed');
    }
  };

  return (
    <li className="feedback-list__item">
      <div className="feedback-list__meta">
        <strong>{KIND_LABELS[item.kind]}</strong>
        <span className="secondary-text">
          {item.senderRole} · {date(item.createdAt)}
        </span>
      </div>
      <p>{item.text ?? <span className="secondary-text">No message</span>}</p>
      {item.device && (
        <ul className="feedback__device secondary-text">
          {Object.entries(item.device).map(([k, v]) => (
            <li key={k}>
              {k}: {String(v)}
            </li>
          ))}
        </ul>
      )}
      <label className="feedback__toggle">
        Status
        <select
          className="field__input"
          value={status}
          onChange={(e) => void change(e.target.value as FeedbackStatus)}
        >
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {saved === 'saved' && <p role="status">Saved</p>}
      {saved === 'failed' && (
        <p role="alert" className="field__error">
          Could not save. Try again.
        </p>
      )}
    </li>
  );
}

/** Operator triage. The API answers 404 to anyone without the operator role. */
export function AdminFeedbackPage() {
  const api = useFeedbackApi();
  const load = useCallback(() => api.listAll(), [api]);
  const { result, retry } = useLoad(load);

  if (
    result.state === 'failed' &&
    result.error instanceof FeedbackApiError &&
    result.error.status === 404
  ) {
    return <NotFoundPage />;
  }
  return (
    <div className="stack">
      <h1>Feedback triage</h1>
      <p className="secondary-text">
        Never copy anything that could identify a family into a public issue.
      </p>
      {result.state === 'loading' && <p aria-live="polite">Loading…</p>}
      {result.state === 'failed' && <Failed retry={retry} />}
      {result.state === 'ready' &&
        (result.data.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          <ul className="feedback-list">
            {result.data.map((item) => (
              <TriageRow key={item.id} item={item} />
            ))}
          </ul>
        ))}
    </div>
  );
}
