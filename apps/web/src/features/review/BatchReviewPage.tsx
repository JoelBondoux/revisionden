import { useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Button } from '../../components/Button';
import { MathText } from '../../components/MathText';
import { Pill } from '../../components/Pill';
import { ConfirmError } from './ConfirmError';
import { STATUS_LABEL, STATUS_TONE } from './ReviewQueuePage';
import { useReviewClient, type ItemDecision, type SampledItem } from './reviewApi';
import './review.css';

const SHOWN = [
  'type',
  'prompt',
  'front',
  'back',
  'options',
  'answer',
  'explanation',
  'steps',
  'hint',
];

const BAND_LABEL: Record<string, string> = { top: 'Top', middle: 'Middle', low: 'Low' };

interface Check {
  name: string;
  result: string;
}
interface Exemplar {
  band: string;
  level: number;
  answer: string;
}
interface MarkSchemeDetail {
  points?: { code: string; description: string }[];
  levels?: { level: number; marks: [number, number]; descriptor: string }[];
}

/**
 * What the reviewer reads for one part of an item. Multiple choice options are numbered from 1
 * and the answer is shown as the correct option itself, never as the zero-based index stored in
 * content (a reviewer reading {"option": 2} as the second option would approve a wrong answer).
 */
function shownLines(key: string, snapshot: Record<string, unknown>): string[] {
  const value = snapshot[key];
  const options = Array.isArray(snapshot.options) ? (snapshot.options as string[]) : null;
  if (key === 'options' && options) return options.map((o, i) => `${i + 1}. ${o}`);
  const option = (value as { option?: unknown } | undefined)?.option;
  if (key === 'answer' && options && typeof option === 'number') {
    return [`Option ${option + 1}: ${options[option] ?? '(missing option)'}`];
  }
  return [typeof value === 'string' ? value : JSON.stringify(value)];
}

function ShownValue({ lines }: { lines: string[] }) {
  if (lines.length === 1) return <MathText text={lines[0]!} />;
  return (
    <ul>
      {lines.map((line, i) => (
        <li key={i}>
          <MathText text={line} />
        </li>
      ))}
    </ul>
  );
}

/** The mark scheme lines a reviewer reads: the item's own, then its linked scheme. */
function markSchemeLines(snapshot: Record<string, unknown>): string[] {
  const own = (snapshot.mark_scheme as string[] | undefined) ?? [];
  const detail = (snapshot.mark_scheme_detail as MarkSchemeDetail | undefined) ?? {};
  const points = (detail.points ?? []).map((p) => `${p.code}: ${p.description}`);
  const levels = (detail.levels ?? []).map(
    (l) => `Level ${l.level} (${l.marks[0]}–${l.marks[1]} marks): ${l.descriptor}`,
  );
  return [...own, ...points, ...levels];
}

/** One batch's review sample. One confirmed error fails the whole batch. */
export function BatchReviewPage() {
  const { batchId = '' } = useParams();
  const client = useReviewClient();
  const [version, setVersion] = useState(0);
  const batch = useApiResource(() => client.batch(batchId), [client, batchId, version]);

  const decide = async (item: SampledItem, decision: ItemDecision, notes?: string) => {
    await client.decideItem(batchId, item.itemId, decision, notes);
    setVersion((v) => v + 1);
  };

  if (batch.status !== 'ready') {
    return (
      <div className="review-page">
        <LoadingOrError resource={batch} />
      </div>
    );
  }
  const { title, status, items } = batch.data;
  const decided = items.filter((i) => i.decision).length;
  return (
    <div className="review-page">
      <LinkButton to="/review" variant="quiet" icon={<BackIcon />}>
        Back to the review queue
      </LinkButton>
      <h1>{title}</h1>
      <p>
        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill> {decided} of {items.length}{' '}
        sampled items decided.
      </p>
      <p className="secondary-text">
        You are reviewing a random 10% of this batch (at least 30 items), plus every item that needs
        human approval. One confirmed error sends the whole batch back for re-checking.
      </p>
      {status === 'failed' && (
        <p role="alert">
          This batch failed: it goes back through the blind answer, review and exact checks, then a
          fresh sample.
        </p>
      )}
      {status === 'passed' && <p>This batch passed with no errors in its sample.</p>}
      {items.map((item) => (
        <SampledItemCard
          key={item.itemId}
          item={item}
          open={status === 'in_review'}
          onDecide={decide}
        />
      ))}
    </div>
  );
}

interface Citation {
  publisher?: string;
  title?: string;
  location?: string;
  quote?: string;
  url?: string;
}

function SampledItemCard({
  item,
  open,
  onDecide,
}: {
  item: SampledItem;
  open: boolean;
  onDecide: (item: SampledItem, d: ItemDecision, notes?: string) => Promise<void>;
}) {
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  const citations = (item.snapshot.citations as Citation[] | undefined) ?? [];
  const scheme = markSchemeLines(item.snapshot);
  const exemplars = (item.snapshot.exemplars as Exemplar[] | undefined) ?? [];
  const checks = (item.snapshot.verification as { checks?: Check[] } | undefined)?.checks ?? [];
  return (
    <article className="card review-item" aria-labelledby={headingId}>
      <h2 id={headingId} className="card__title">
        {item.itemId}
      </h2>
      <p className="secondary-text">
        Version {item.itemVersion}
        {item.needsHumanApproval ? ' · needs human approval' : ''}
      </p>
      <dl>
        {SHOWN.filter((k) => item.snapshot[k] !== undefined).map((k) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              <ShownValue lines={shownLines(k, item.snapshot)} />
            </dd>
          </div>
        ))}
      </dl>
      {scheme.length > 0 && (
        <>
          <h3>Mark scheme</h3>
          <ul>
            {scheme.map((line, i) => (
              <li key={i}>
                <MathText text={line} />
              </li>
            ))}
          </ul>
        </>
      )}
      {exemplars.length > 0 && (
        <>
          <h3>Example answers</h3>
          <ul>
            {exemplars.map((e, i) => (
              <li key={i}>
                {BAND_LABEL[e.band] ?? e.band} ({e.level}): {e.answer}
              </li>
            ))}
          </ul>
        </>
      )}
      {checks.length > 0 && (
        <>
          <h3>Checks</h3>
          <ul>
            {checks.map((c) => (
              <li key={c.name}>
                {c.name}: {c.result === 'pass' ? 'pass' : 'FAIL'}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Sources</h3>
      <ul>
        {citations.map((c, i) => (
          <li key={i}>
            {c.publisher}, {c.location}: “{c.quote ?? 'no quote yet'}”
          </li>
        ))}
      </ul>
      {item.decision ? (
        <p>
          {item.decision === 'approved' ? 'Approved' : 'Error confirmed'} by {item.decidedByRole}
          {item.decisionNotes ? `: ${item.decisionNotes}` : ''}
        </p>
      ) : open && confirming ? (
        <ConfirmError
          onConfirm={(notes) => void onDecide(item, 'confirmed_error', notes)}
          onCancel={() => setConfirming(false)}
        />
      ) : open ? (
        <div className="review-actions">
          <Button variant="success" onClick={() => void onDecide(item, 'approved')}>
            Approve
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Confirm error
          </Button>
        </div>
      ) : null}
    </article>
  );
}
