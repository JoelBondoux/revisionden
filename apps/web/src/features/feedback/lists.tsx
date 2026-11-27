import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { ChatIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { Pill, type PillTone } from '../../components/Pill';
import { NotFoundPage } from '../../pages/NotFoundPage';
import {
  FEEDBACK_STATUSES,
  FeedbackApiError,
  KIND_LABELS,
  OUTCOME_LABELS,
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

/** A short start of the message, cut at a word, for the "Duplicate of…" list. */
export function snippet(text: string | null, max = 40): string {
  if (!text) return 'No message';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

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
                {item.outcome && <p className="feedback__thanks">Confirmed – thank you!</p>}
                {item.replies.map((reply) => (
                  <div key={reply.createdAt} className="feedback__reply">
                    <strong>Reply from RevisionDen</strong>
                    <p>{reply.body}</p>
                    <p className="secondary-text">{date(reply.createdAt)}</p>
                  </div>
                ))}
                <p className="secondary-text">
                  {sender(item, scope)} · {date(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ))}
      <LinkButton to="/feedback" variant="secondary" icon={<ChatIcon />}>
        Send feedback
      </LinkButton>
    </div>
  );
}

/**
 * Bug Hunter (docs/REWARDS.md): confirm a new bug, or confirm it as a duplicate. Or mark it Not a
 * bug (L13): closed as will not fix, no reward; three in 14 days rest the student's bug button.
 */
function ConfirmBug({
  item,
  originals,
  onConfirmed,
}: {
  item: TriageFeedback;
  originals: TriageFeedback[];
  onConfirmed: (item: TriageFeedback, message: string) => void;
}) {
  const api = useFeedbackApi();
  const [original, setOriginal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirm = async (duplicateOf?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await (duplicateOf ? api.confirm(item.id, duplicateOf) : api.confirm(item.id));
      onConfirmed(result.item, result.message);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : 'Could not confirm. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const notABug = async () => {
    setBusy(true);
    setError(undefined);
    try {
      onConfirmed(await api.markNotABug(item.id), 'Marked Not a bug. Closed as will not fix.');
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feedback__confirm">
      <Button disabled={busy} onClick={() => void confirm()}>
        Confirm bug
      </Button>
      <label className="feedback__toggle">
        Duplicate of…
        <select
          className="field__input"
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
        >
          <option value="">Choose a confirmed report</option>
          {originals.map((o) => (
            <option key={o.id} value={o.id}>
              {KIND_LABELS[o.kind]}: {snippet(o.text)} ({date(o.createdAt)})
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        disabled={busy || !original}
        onClick={() => void confirm(original)}
      >
        Confirm as duplicate
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => void notABug()}>
        Not a bug
      </Button>
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

function TriageRow({
  item,
  originals,
  onConfirmed,
}: {
  item: TriageFeedback;
  originals: TriageFeedback[];
  onConfirmed: (item: TriageFeedback) => void;
}) {
  const api = useFeedbackApi();
  const [confirmedMessage, setConfirmedMessage] = useState<string>();
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
        {item.outcome && <Pill tone="success">{OUTCOME_LABELS[item.outcome]}</Pill>}
        {item.rewardXp > 0 && <span className="secondary-text">+{item.rewardXp} XP</span>}
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
      {item.kind === 'bug' && item.outcome === null && (
        <ConfirmBug
          item={item}
          originals={originals}
          onConfirmed={(next, message) => {
            setConfirmedMessage(message);
            setStatus(next.status);
            onConfirmed(next);
          }}
        />
      )}
      {confirmedMessage && <p role="status">{confirmedMessage}</p>}
    </li>
  );
}

/** Operator triage. The API answers 404 to anyone without the operator role. */
export function AdminFeedbackPage() {
  const api = useFeedbackApi();
  const [view, setView] = useState<'feedback' | 'errors'>('feedback');
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
      <div className="feedback-filter" role="group" aria-label="Show">
        <Button
          variant={view === 'feedback' ? 'primary' : 'secondary'}
          aria-pressed={view === 'feedback'}
          onClick={() => setView('feedback')}
        >
          Feedback
        </Button>
        <Button
          variant={view === 'errors' ? 'primary' : 'secondary'}
          aria-pressed={view === 'errors'}
          onClick={() => setView('errors')}
        >
          Error reports
        </Button>
      </div>
      {view === 'errors' ? <ErrorReportList /> : <TriageList result={result} retry={retry} />}
    </div>
  );
}

function TriageList({ result, retry }: { result: Load<TriageFeedback[]>; retry: () => void }) {
  return (
    <>
      {result.state === 'loading' && <p aria-live="polite">Loading…</p>}
      {result.state === 'failed' && <Failed retry={retry} />}
      {result.state === 'ready' &&
        (result.data.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          <TriageItems initial={result.data} />
        ))}
    </>
  );
}

/** Anonymous error reports from the last 24 hours, grouped by screen and failing API call. */
function ErrorReportList() {
  const api = useFeedbackApi();
  const load = useCallback(() => api.errorReports(), [api]);
  const { result, retry } = useLoad(load);
  if (result.state === 'loading') return <p aria-live="polite">Loading…</p>;
  if (result.state === 'failed') return <Failed retry={retry} />;
  const { groups } = result.data;
  if (groups.length === 0) return <p>No error reports in the last 24 hours.</p>;
  return (
    <ul className="feedback-list">
      {groups.map((g) => {
        const label = `${g.screen}${g.apiPath ? ` → ${g.apiPath} ${g.status ?? ''}` : ''}`.trim();
        return (
          <li key={label} aria-label={label} className="feedback-item">
            <p>
              <strong>{label}</strong> · {g.count} {g.count === 1 ? 'report' : 'reports'}
            </p>
            <p className="secondary-text">
              {date(g.firstSeen)} to {date(g.lastSeen)} · builds {g.builds.join(', ')}
            </p>
            <p className="secondary-text">
              Codes: <code>{g.refs.join(' ')}</code>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Keeps confirmed items up to date, so a later bug can be marked a duplicate of one at once. */
function TriageItems({ initial }: { initial: TriageFeedback[] }) {
  const [items, setItems] = useState(initial);
  const replace = useCallback(
    (next: TriageFeedback) => setItems((all) => all.map((i) => (i.id === next.id ? next : i))),
    [],
  );
  return (
    <ul className="feedback-list">
      {items.map((item) => (
        <TriageRow
          key={item.id}
          item={item}
          originals={items.filter(
            (o) => o.outcome === 'confirmed' && o.id !== item.id && o.createdAt < item.createdAt,
          )}
          onConfirmed={replace}
        />
      ))}
    </ul>
  );
}
