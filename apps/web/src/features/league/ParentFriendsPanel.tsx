import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { REPORT_REASON_LABELS } from '@revisionden/core';
import { defaultBaseUrl } from '../../api/ApiContext';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Avatar, Button, Card } from '../../components';
import { createLeagueApi, type ParentLeagueApi } from './leagueApi';
import { isNotAvailable } from './tiles';
import './league.css';

function LabelEditor({
  nickname,
  initial,
  onSave,
}: {
  nickname: string;
  initial: string | null;
  onSave: (label: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? '');
  const id = `label-${nickname}`;
  return (
    <span className="league-label">
      <label htmlFor={id} className="visually-hidden">
        Private label for {nickname}
      </label>
      <input
        id={id}
        className="input"
        maxLength={30}
        value={value}
        placeholder="Private label (only you see it)"
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        variant="secondary"
        aria-label={`Save label for ${nickname}`}
        onClick={() => onSave(value.trim() || null)}
      >
        Save
      </Button>
    </span>
  );
}

/** A parent's Friends card for one child (docs/FRIENDS_LEAGUE.md section 6). */
export function ParentFriendsPanel({
  api: given,
  studentId,
  nickname,
}: {
  api?: ParentLeagueApi;
  studentId: string;
  /** The child's nickname, when the caller knows it. */
  nickname?: string;
}) {
  const api = useMemo(
    () =>
      given ??
      createLeagueApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [given],
  );
  const [version, setVersion] = useState(0);
  const view = useApiResource(() => api.getChildFriends(studentId), [api, studentId, version]);
  const run = async (action: () => Promise<void>) => {
    await action();
    setVersion((v) => v + 1);
  };
  if (view.status === 'error' && isNotAvailable(view.error)) {
    return <p className="secondary-text">Friends aren't available yet.</p>;
  }
  if (view.status !== 'ready') return <LoadingOrError resource={view} />;
  const d = view.data;
  return (
    <Card title={nickname ? `Friends: ${nickname}` : 'Friends'} className="parent-friends">
      <label className="league-hide">
        <input
          type="checkbox"
          checked={d.allowed}
          onChange={(e) => run(() => api.setAllowed(studentId, e.target.checked))}
        />
        {nickname ? `Allow friends for ${nickname}` : 'Allow friends'}
      </label>
      <p className="secondary-text">
        Friends see only a nickname, avatar, title and this week's league XP. No chat. One parent in
        each family approves every friend.
        {d.hidden && ` ${nickname ?? 'Your child'} has chosen to hide from the league.`}
      </p>

      {d.waitingForYou.length > 0 && (
        <section aria-label="Waiting for you">
          <h3>Waiting for you</h3>
          <ul className="league-friends">
            {d.waitingForYou.map((w) => (
              <li key={w.requestId} className="league-check">
                <Avatar code={w.avatarCode} nickname={w.nickname} size={36} />
                <span>{w.nickname}</span>
                <Button
                  aria-label={`Approve ${w.nickname}`}
                  onClick={() => run(() => api.approve(studentId, w.requestId))}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Decline ${w.nickname}`}
                  onClick={() => run(() => api.decline(studentId, w.requestId))}
                >
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.waitingForOther.length > 0 && (
        <p className="secondary-text">
          Waiting for the other family: {d.waitingForOther.map((w) => w.nickname).join(', ')}
        </p>
      )}

      <section aria-label="Friends">
        <h3>Friends</h3>
        {d.friends.length === 0 && <p className="secondary-text">No friends yet.</p>}
        <ul className="league-friends">
          {d.friends.map((f) => (
            <li key={f.id} className="stack">
              <span className="league-check">
                <Avatar code={f.avatarCode} nickname={f.nickname} size={36} />
                <span>
                  {f.nickname}
                  {f.sibling && ' (in your family)'}
                </span>
                {f.label && <span className="secondary-text">{f.label}</span>}
              </span>
              {!f.sibling && (
                <span className="league-check">
                  <LabelEditor
                    nickname={f.nickname}
                    initial={f.label}
                    onSave={(label) => run(() => api.setLabel(studentId, f.id, label))}
                  />
                  <Button
                    variant="secondary"
                    aria-label={`Remove ${f.nickname}`}
                    onClick={() => run(() => api.parentRemove(studentId, f.id))}
                  >
                    Remove
                  </Button>
                  <Button
                    variant="danger"
                    aria-label={`Block ${f.nickname}`}
                    onClick={() => run(() => api.parentBlock(studentId, f.id))}
                  >
                    Block
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {d.blocked.length > 0 && (
        <section aria-label="Blocked">
          <h3>Blocked</h3>
          <ul className="league-friends">
            {d.blocked.map((b) => (
              <li key={b.id} className="league-check">
                <span>{b.nickname}</span>
                <Button
                  variant="secondary"
                  aria-label={`Unblock ${b.nickname}`}
                  onClick={() => run(() => api.unblock(studentId, b.id))}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.reports.length > 0 && (
        <section aria-label="Reports">
          <h3>Reports</h3>
          <ul>
            {d.reports.map((r) => (
              <li key={r.id}>
                {r.reporter} reported {r.reported}: {REPORT_REASON_LABELS[r.reason]} (
                {new Date(r.at).toLocaleDateString('en-GB')})
                {r.closed ? (
                  <span className="secondary-text"> (dealt with)</span>
                ) : (
                  r.direction === 'made' && (
                    <Button
                      variant="secondary"
                      onClick={() => run(() => api.closeReport(studentId, r.id))}
                    >
                      Mark as dealt with
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

/** /parent/friends/:studentId, from the child's card in the parent home. */
export function ParentFriendsPage() {
  const { studentId = '' } = useParams();
  const [params] = useSearchParams();
  return (
    <div className="stack">
      <h1>Friends</h1>
      <ParentFriendsPanel studentId={studentId} nickname={params.get('name') ?? undefined} />
    </div>
  );
}
