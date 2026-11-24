import { useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useStudent } from '../../session/StudentContext';
import { buildInfo } from '../about/buildInfo';
import {
  collectDeviceDetails,
  findPersonalDetails,
  PERSONAL_DETAILS_MESSAGE,
  type DeviceDetails,
} from './details';
import {
  FEEDBACK_KINDS,
  FeedbackApiError,
  KIND_LABELS,
  useFeedbackApi,
  type FeedbackKind,
  type FeedbackRequest,
} from './feedbackApi';
import './feedback.css';

const MAX_TEXT = 500;

const isKind = (value: string | null): value is FeedbackKind =>
  FEEDBACK_KINDS.includes(value as FeedbackKind);

function currentDeviceDetails(route: string): DeviceDetails {
  return collectDeviceDetails({
    appVersion: buildInfo.version,
    route,
    userAgent: navigator.userAgent,
    width: window.screen?.width ?? window.innerWidth,
    height: window.screen?.height ?? window.innerHeight,
    online: navigator.onLine,
  });
}

/**
 * Feedback and bug reports (docs/PRODUCT_RULES.md). On a student's device it is sent as the
 * student, otherwise as the signed-in parent. Mistakes in a question use "Report a problem".
 */
export function FeedbackPage() {
  const api = useFeedbackApi();
  const { studentId } = useStudent();
  const sender = studentId ? 'student' : 'parent';
  const [params] = useSearchParams();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const route = typeof from === 'string' ? from : location.pathname;

  const preset = params.get('kind');
  const [kind, setKind] = useState<FeedbackKind | undefined>(isKind(preset) ? preset : undefined);
  const [text, setText] = useState('');
  const [includeDevice, setIncludeDevice] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const device = currentDeviceDetails(route);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return setError('Choose what kind of feedback this is.');
    if (findPersonalDetails(text)) return setError(PERSONAL_DETAILS_MESSAGE);
    const body: FeedbackRequest = { kind };
    if (text.trim()) body.text = text.trim();
    if (includeDevice) body.device = device;
    setBusy(true);
    setError(undefined);
    try {
      await api.send(sender, body);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof FeedbackApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="stack">
        <h1>Thank you!</h1>
        <p>We read every message. You can see what happens to it in your feedback list.</p>
        <ul className="link-list">
          <li>
            <Link to={sender === 'parent' ? '/feedback/family' : '/feedback/mine'}>
              See your feedback
            </Link>
          </li>
          <li>
            <Link to="/about">Back to About</Link>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <form className="stack feedback" onSubmit={submit} noValidate>
      <h1>Send feedback</h1>
      <p className="secondary-text">
        Found a mistake in a question? Use &ldquo;Report a problem&rdquo; on the question instead,
        so we can hide it straight away.
      </p>
      {sender === 'student' && <p className="feedback__note">Your parent can see what you send.</p>}

      <fieldset className="feedback__kinds">
        <legend className="field__label">What is it about?</legend>
        {FEEDBACK_KINDS.map((k) => (
          <label key={k} className="feedback__kind">
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            {KIND_LABELS[k]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field__label">Tell us more (optional)</span>
        <textarea
          className="field__input feedback__text"
          maxLength={MAX_TEXT}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="feedback-count feedback-privacy"
        />
      </label>
      <p className="secondary-text feedback__count" id="feedback-count">
        {text.length} / {MAX_TEXT}
      </p>
      <p className="secondary-text" id="feedback-privacy">
        Please leave out names, email addresses and phone numbers.
      </p>

      <Card>
        <label className="feedback__toggle">
          <input
            type="checkbox"
            checked={includeDevice}
            onChange={(e) => setIncludeDevice(e.target.checked)}
          />
          Include device details
        </label>
        {includeDevice && (
          <ul className="feedback__device secondary-text">
            <li>App version: {device.appVersion}</li>
            <li>Screen: {device.route}</li>
            <li>Browser: {device.browserFamily}</li>
            <li>Screen size: {device.screenSize}</li>
            <li>Connection: {device.online ? 'online' : 'offline'}</li>
          </ul>
        )}
        <p className="secondary-text">Never your IP address, location or contacts.</p>
      </Card>

      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        Send
      </Button>
    </form>
  );
}
