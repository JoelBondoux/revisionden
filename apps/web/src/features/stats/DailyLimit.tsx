import { useEffect, useState, type FormEvent } from 'react';
import type { ParentDailyLimit } from '@revisionden/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { useApiResource } from '../../api/useApiResource';
import { useStatsApi } from './statsApi';

const minutes = (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'}`;

/**
 * The student's daily limit for today (workstream K7): minutes left, and a one-time notice when a
 * parent has changed the limit. Stopping early is always fine; nothing is lost.
 */
export function DailyLimitToday() {
  const api = useStatsApi();
  const limit = useApiResource(() => api.getMyDailyLimit(), [api]);
  const [noticeGone, setNoticeGone] = useState(false);
  if (limit.status !== 'ready') return null;
  const today = limit.data;
  const changed = noticeGone ? null : today.changed;

  return (
    <>
      {changed && (
        <div role="status" aria-label="Daily limit changed" className="card limit-notice">
          <p>
            {`Your daily limit is now ${minutes(changed.schoolDayMinutes)} on school days and ${minutes(changed.otherDayMinutes)} on other days.`}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setNoticeGone(true);
              void api.markDailyLimitSeen().catch(() => undefined);
            }}
          >
            Got it
          </Button>
        </div>
      )}
      <Card title="Today">
        <ProgressBar
          label="Daily limit"
          value={today.usedMinutes}
          max={today.limitMinutes}
          valueText={`${today.usedMinutes} of ${today.limitMinutes} minutes`}
        />
        <p>
          {today.reached
            ? 'Great work today. See you tomorrow'
            : `${minutes(today.leftMinutes)} left today. You can stop whenever you like.`}
        </p>
      </Card>
    </>
  );
}

function SuggestionBox({
  suggestion,
  onAccept,
  onChange,
  onDismiss,
}: {
  suggestion: NonNullable<ParentDailyLimit['suggestion']>;
  onAccept: () => void;
  onChange: () => void;
  onDismiss: () => void;
}) {
  const by = Math.abs(suggestion.change);
  return (
    <div role="group" aria-label="Suggestion" className="limit-suggestion">
      <p className="limit-suggestion__title">
        {suggestion.kind === 'raise' ? `Raise by ${by} minutes` : `Ease off by ${by} minutes`}
        {` (to ${suggestion.schoolDayMinutes} on school days, ${suggestion.otherDayMinutes} on other days)`}
      </p>
      <p className="secondary-text">{suggestion.reason}</p>
      <div className="limit-suggestion__actions">
        <Button onClick={onAccept}>Accept</Button>
        <Button variant="secondary" onClick={onChange}>
          Change
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * The parent's daily limit panel: the limit per day type, today's minutes, the exam-season
 * extra, and the weekly suggestion to accept, change or dismiss. The app never changes the limit
 * by itself.
 */
export function DailyLimitPanel({ studentId }: { studentId: string }) {
  const api = useStatsApi();
  const loaded = useApiResource(() => api.getDailyLimit(studentId), [api, studentId]);
  const [view, setView] = useState<ParentDailyLimit | null>(null);
  const [school, setSchool] = useState('');
  const [other, setOther] = useState('');
  const [extra, setExtra] = useState(false);
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);

  const show = (next: ParentDailyLimit) => {
    setView(next);
    setSchool(String(next.settings.schoolDayMinutes));
    setOther(String(next.settings.otherDayMinutes));
    setExtra(next.settings.examSeasonExtra);
  };
  useEffect(() => {
    if (loaded.status === 'ready') show(loaded.data);
  }, [loaded]);

  if (!view) return null;
  const run = async (action: () => Promise<ParentDailyLimit>, saved?: string) => {
    try {
      show(await action());
      setMessage(saved ? { kind: 'saved', text: saved } : null);
    } catch {
      setMessage({ kind: 'error', text: 'Could not save. Please try again.' });
    }
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    void run(
      () =>
        api.saveDailyLimit(studentId, {
          schoolDayMinutes: Number(school),
          otherDayMinutes: Number(other),
          examSeasonExtra: extra,
        }),
      'Saved',
    );
  };
  const label = (n: number, custom: boolean) =>
    `${n} minutes (${custom ? 'set by you' : 'default'})`;

  return (
    <Card title="Daily limit">
      <ul className="stats-list">
        <li>{`School days: ${label(view.settings.schoolDayMinutes, view.custom.school)}`}</li>
        <li>{`Other days: ${label(view.settings.otherDayMinutes, view.custom.other)}`}</li>
        <li>{`Today: ${view.today.usedMinutes} of ${view.today.limitMinutes} minutes`}</li>
      </ul>
      {view.suggestion && (
        <SuggestionBox
          suggestion={view.suggestion}
          onAccept={() => void run(() => api.answerSuggestion(studentId, 'accept'))}
          onChange={() => {
            setSchool(String(view.suggestion!.schoolDayMinutes));
            setOther(String(view.suggestion!.otherDayMinutes));
          }}
          onDismiss={() => void run(() => api.answerSuggestion(studentId, 'dismiss'))}
        />
      )}
      <form className="limit-form no-print" onSubmit={save}>
        <label className="field">
          <span>School days (minutes)</span>
          <input
            type="number"
            min={15}
            max={360}
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Other days (minutes)</span>
          <input
            type="number"
            min={15}
            max={360}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        </label>
        <label className="limit-form__check">
          <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
          <span>Add 30 minutes in exam season</span>
        </label>
        <p className="secondary-text">
          {`We suggest no more than ${view.ceilings.school} minutes on school days and ${view.ceilings.other} on other days.`}
        </p>
        <Button type="submit">Save limit</Button>
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className="secondary-text">
            {message.text}
          </p>
        )}
      </form>
    </Card>
  );
}
