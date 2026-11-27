import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { BackIcon, DocumentIcon } from '../../components/icons';
import { LinkButton, TextLink } from '../../components/links';
import { Card } from '../../components/Card';
import { ErrorRef, refOf, type ErrorDetails } from '../../api/ErrorRef';
import { useStudent } from '../../session/StudentContext';
import { buildInfo } from '../about/buildInfo';
import { SUPPORT_EMAIL } from '../legal/supportEmail';
import {
  collectDeviceDetails,
  currentDisplayDetails,
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

function currentDeviceDetails(route: string): DeviceDetails {
  return {
    ...collectDeviceDetails({
      appVersion: buildInfo.version,
      route,
      userAgent: navigator.userAgent,
      width: window.screen?.width ?? window.innerWidth,
      height: window.screen?.height ?? window.innerHeight,
      online: navigator.onLine,
    }),
    ...currentDisplayDetails(),
  };
}

interface FeedbackFormProps {
  /** The kind chosen when the form opens (from a link, or "bug" from the bug button). */
  initialKind?: FeedbackKind;
  /** The screen the report is about, shown in the device details. */
  route: string;
  /** "page" for /feedback; "sheet" inside the bug button's sheet (no page heading). */
  variant?: 'page' | 'sheet';
  /** Closes the sheet from the thank-you message. */
  onClose?: () => void;
}

/**
 * The feedback and bug report form (docs/PRODUCT_RULES.md). On a student's device it is sent as
 * the student, otherwise as the signed-in parent. Used by /feedback and the bug button's sheet.
 */
export function FeedbackForm({ initialKind, route, variant = 'page', onClose }: FeedbackFormProps) {
  const api = useFeedbackApi();
  const { studentId } = useStudent();
  const sender = studentId ? 'student' : 'parent';
  const [kind, setKind] = useState<FeedbackKind | undefined>(initialKind);
  const [text, setText] = useState('');
  // High-privacy default for children (Children's Code): off for students, on for parents.
  const [includeDevice, setIncludeDevice] = useState(sender === 'parent');
  const [error, setError] = useState<string>();
  const [errorRef, setErrorRef] = useState<ErrorDetails>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const device = currentDeviceDetails(route);
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return setError('Choose what kind of feedback this is.');
    if (findPersonalDetails(text)) return setError(PERSONAL_DETAILS_MESSAGE);
    const body: FeedbackRequest = { kind };
    if (text.trim()) body.text = text.trim();
    if (includeDevice) body.device = device;
    setBusy(true);
    setError(undefined);
    setErrorRef(undefined);
    try {
      await api.send(sender, body);
      setSent(true);
    } catch (err) {
      setErrorRef(refOf(err));
      setError(
        err instanceof FeedbackApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const inSheet = variant === 'sheet';
  if (sent) {
    return (
      <div className="stack">
        {inSheet ? <h3>Thank you!</h3> : <h1>Thank you!</h1>}
        <p>We read every message. You can see what happens to it in your feedback list.</p>
        <LinkButton
          to={sender === 'parent' ? '/feedback/family' : '/feedback/mine'}
          variant="secondary"
          icon={<DocumentIcon />}
          block
        >
          See your feedback
        </LinkButton>
        {!inSheet && (
          <LinkButton to="/about" variant="quiet" icon={<BackIcon />}>
            Back to About
          </LinkButton>
        )}
        {inSheet && onClose && (
          <Button variant="secondary" block onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form className="stack feedback" onSubmit={submit} noValidate>
      {!inSheet && <h1>Send feedback</h1>}
      <p className="secondary-text">
        Found a mistake in a question? Use &ldquo;Report a problem&rdquo; on the question instead,
        so we can hide it straight away.
      </p>
      {sender === 'student' && <p className="feedback__note">Your parent can see what you send.</p>}
      <p className="secondary-text">
        Prefer email? <TextLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</TextLink>. Please
        include only the personal details we need to help you.
      </p>

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
          aria-describedby={`${id}-count ${id}-privacy`}
        />
      </label>
      <p className="secondary-text feedback__count" id={`${id}-count`}>
        {text.length} / {MAX_TEXT}
      </p>
      <p className="secondary-text" id={`${id}-privacy`}>
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
            {device.lastProblem && <li>Last problem: {device.lastProblem}</li>}
            {device.contentId && <li>Question or card: {device.contentId}</li>}
            <li>
              Look: {device.look ?? 'default'}, {device.theme}, pattern {device.pattern}
            </li>
            <li>
              Pixel ratio {device.pixelRatio}, zoom {device.zoom}, text size ×{device.textScale}
            </li>
          </ul>
        )}
        <p className="secondary-text">Never your IP address, location or contacts.</p>
      </Card>

      {error && (
        <div role="alert">
          <p className="field__error">{error}</p>
          <ErrorRef code={errorRef} />
        </div>
      )}
      <Button type="submit" block disabled={busy}>
        Send
      </Button>
    </form>
  );
}
