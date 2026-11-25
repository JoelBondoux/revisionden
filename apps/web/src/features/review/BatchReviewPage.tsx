import { useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { ConfirmError } from './ConfirmError';
import { STATUS_LABEL, STATUS_TONE } from './ReviewQueuePage';
import { useReviewClient, type ItemDecision, type SampledItem } from './reviewApi';
import './review.css';

const SHOWN = ['type', 'prompt', 'front', 'back', 'options', 'answer', 'explanation', 'steps'];

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
              {typeof item.snapshot[k] === 'string'
                ? (item.snapshot[k] as string)
                : JSON.stringify(item.snapshot[k])}
            </dd>
          </div>
        ))}
      </dl>
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
