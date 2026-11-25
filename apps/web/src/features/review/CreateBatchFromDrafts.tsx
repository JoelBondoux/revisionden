import { useId, useState, type FormEvent } from 'react';
import { useApiResource } from '../../api/useApiResource';
import { Button } from '../../components/Button';
import { useReviewClient } from './reviewApi';

/**
 * Content leads only: put every draft item that passed all automated checks into a new review
 * batch (docs/VERIFICATION.md section 3). The server picks the items and draws the sample.
 */
export function CreateBatchFromDrafts({ onCreated }: { onCreated: (size: number) => void }) {
  const client = useReviewClient();
  const id = useId();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = useApiResource(() => client.readyDrafts(), [client]);
  if (ready.status !== 'ready') return null;
  if (ready.data === 0) return <p>No draft items are ready for review.</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const batch = await client.createBatchFromDrafts(title.trim());
      onCreated(batch.size);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="review-confirm" onSubmit={(e) => void submit(e)}>
      <p>
        {ready.data} draft {ready.data === 1 ? 'item is' : 'items are'} ready for review.
      </p>
      <label htmlFor={id}>Batch name</label>
      <input
        id={id}
        value={title}
        maxLength={200}
        required
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="review-actions">
        <Button type="submit" disabled={busy || !title.trim()}>
          Create batch from draft items
        </Button>
      </div>
    </form>
  );
}
