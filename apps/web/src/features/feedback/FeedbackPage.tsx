import { useLocation, useSearchParams } from 'react-router-dom';
import { FeedbackForm } from './FeedbackForm';
import { FEEDBACK_KINDS, type FeedbackKind } from './feedbackApi';

const isKind = (value: string | null): value is FeedbackKind =>
  FEEDBACK_KINDS.includes(value as FeedbackKind);

/**
 * Feedback and bug reports (docs/PRODUCT_RULES.md). The kind can come from the link
 * (`?kind=bug`) and the screen from the link's state (`{ from: '/cards' }`). Mistakes in a
 * question use "Report a problem".
 */
export function FeedbackPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const route = typeof from === 'string' ? from : location.pathname;
  const preset = params.get('kind');
  return <FeedbackForm initialKind={isKind(preset) ? preset : undefined} route={route} />;
}
