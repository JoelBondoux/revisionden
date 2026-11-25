import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { COMPLAINT_REQUEST_TOPICS, type ComplaintRequestTopic } from '@revisionden/core';
import { Button } from '../../components/Button';
import {
  ComplaintsApiError,
  defaultComplaintRequestSender,
  type ComplaintRequestBody,
} from './complaintsApi';
import '../feedback/feedback.css';

/**
 * "Ask a parent to raise something" (owner, 2026-11-25): only parents make formal complaints,
 * so a student asks theirs. The topic and optional note go to the parents only.
 */
export function AskParentPage({
  send: given,
}: {
  send?: (body: ComplaintRequestBody) => Promise<void>;
}) {
  const send = useMemo(() => given ?? defaultComplaintRequestSender(), [given]);
  const [topic, setTopic] = useState<ComplaintRequestTopic>();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    setError(undefined);
    try {
      await send({ topic, ...(note.trim() ? { note: note.trim() } : {}) });
      setSent(true);
      setNote('');
    } catch (err) {
      setError(
        err instanceof ComplaintsApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  };

  return (
    <div className="stack">
      <h1>Ask a parent to raise something</h1>
      <p>
        If something about RevisionDen seems wrong or unfair, you can ask your parent or carer to
        raise it with us. They will see your message in their parent area.
      </p>
      <p>
        If you feel unsafe, upset or worried about something, <Link to="/help">Get help</Link> has
        people you can talk to straight away.
      </p>
      <form className="stack" onSubmit={(e) => void submit(e)}>
        <fieldset className="stack">
          <legend>What is it about?</legend>
          {(Object.entries(COMPLAINT_REQUEST_TOPICS) as [ComplaintRequestTopic, string][]).map(
            ([value, label]) => (
              <label key={value} className="feedback__toggle">
                <input
                  type="radio"
                  name="topic"
                  value={value}
                  checked={topic === value}
                  onChange={() => setTopic(value)}
                />
                {label}
              </label>
            ),
          )}
        </fieldset>
        <label className="field">
          Anything to add for your parents? (optional)
          <textarea
            className="field__input"
            value={note}
            maxLength={300}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="secondary-text">Please leave out email addresses and phone numbers.</p>
        <Button type="submit" disabled={!topic}>
          Send to my parents
        </Button>
        {error && <p role="alert">{error}</p>}
        {sent && <p role="status">Sent. Your parents will see it in their parent area.</p>}
      </form>
    </div>
  );
}
