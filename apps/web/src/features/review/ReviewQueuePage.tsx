import { useState } from 'react';
import { TextLink } from '../../components/links';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { ConfirmError } from './ConfirmError';
import {
  REASON_LABELS,
  useReviewClient,
  type BatchStatus,
  type ItemReport,
  type ReportDecision,
} from './reviewApi';
import './review.css';

export const STATUS_LABEL: Record<BatchStatus, string> = {
  in_review: 'In review',
  passed: 'Passed',
  failed: 'Failed',
};
export const STATUS_TONE = { in_review: 'warning', passed: 'success', failed: 'streak' } as const;

/** The reviewer's home: reported problems and batches waiting for the sampling rule. */
export function ReviewQueuePage() {
  const client = useReviewClient();
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const data = useApiResource(async () => {
    const [me, reports, batches] = await Promise.all([
      client.me(),
      client.openReports(),
      client.batches(),
    ]);
    return { me, reports, batches };
  }, [client, version]);

  if (data.status === 'error' && data.error.status === 403) {
    return (
      <div className="review-page">
        <h1>Review queue</h1>
        <p>This page is for reviewers only.</p>
      </div>
    );
  }

  const decide = async (report: ItemReport, decision: ReportDecision, notes?: string) => {
    await client.decideReport(report.id, decision, notes);
    setSaved(true);
    setVersion((v) => v + 1);
  };

  return (
    <div className="review-page">
      <h1>Review queue</h1>
      {saved && (
        <p role="status" className="review-saved">
          Decision saved.
        </p>
      )}
      {data.status !== 'ready' ? (
        <LoadingOrError resource={data} />
      ) : (
        <>
          <p className="secondary-text">
            Signed in as {data.data.me.role}. Decisions are recorded by role, never by name.
          </p>
          <Card title="Reported problems">
            {data.data.reports.length === 0 ? (
              <p>No open reports.</p>
            ) : (
              <ul className="review-list">
                {data.data.reports.map((r) => (
                  <ReportRow key={r.id} report={r} onDecide={decide} />
                ))}
              </ul>
            )}
          </Card>
          <Card title="Batches">
            {data.data.batches.length === 0 ? (
              <p>No batches yet.</p>
            ) : (
              <ul className="review-list">
                {data.data.batches.map((b) => (
                  <li key={b.id}>
                    <TextLink to={`/review/batches/${b.id}`}>{b.title}</TextLink>{' '}
                    <Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill>
                    <div className="secondary-text">
                      {b.decided} of {b.sampleSize} sampled items decided
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ReportRow({
  report,
  onDecide,
}: {
  report: ItemReport;
  onDecide: (r: ItemReport, d: ReportDecision, notes?: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      <strong>{report.itemId}</strong> (version {report.itemVersion}):{' '}
      {REASON_LABELS[report.reason] ?? report.reason}, reported by a {report.reportedBy}. The item
      is hidden until you decide.
      {confirming ? (
        <ConfirmError
          onConfirm={(notes) => void onDecide(report, 'confirmed_error', notes)}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div className="review-actions">
          <Button variant="success" onClick={() => void onDecide(report, 'no_error')}>
            No error
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Confirm error
          </Button>
        </div>
      )}
    </li>
  );
}
