import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';

interface ConfirmErrorProps {
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

/** Asks for what is wrong before a confirmed error, because it hides the item and re-checks. */
export function ConfirmError({ onConfirm, onCancel }: ConfirmErrorProps) {
  const [notes, setNotes] = useState('');
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (notes.trim()) onConfirm(notes.trim());
  };
  return (
    <form className="review-confirm" onSubmit={submit}>
      <p>
        A confirmed error keeps the item hidden, recalculates scores and re-checks every item from
        the same batch, writer prompt and source.
      </p>
      <label htmlFor={id}>What is wrong?</label>
      <textarea
        id={id}
        value={notes}
        maxLength={1000}
        required
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="review-actions">
        <Button type="submit" variant="danger" disabled={!notes.trim()}>
          Yes, confirm the error
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
