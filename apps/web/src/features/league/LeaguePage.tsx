import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  ordinal,
  type Friend,
  type FriendCard,
  type LeagueEntry,
  type LeagueResponse,
  type ReportReason,
  type StudentFriendsResponse,
} from '@revisionden/core';
import { defaultBaseUrl } from '../../api/ApiContext';
import { ApiError } from '../../api/client';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Avatar, Button, Card, Sheet } from '../../components';
import { createLeagueApi, type StudentLeagueApi } from './leagueApi';
import './league.css';

/** Nickname with the two-part title underneath (R8). */
function Who({ card, you = false }: { card: FriendCard; you?: boolean }) {
  return (
    <span className="league-who">
      <span className="league-who__name">
        {card.nickname}
        {you && ' (you)'}
      </span>
      {card.title && <span className="league-who__title">{card.title}</span>}
    </span>
  );
}

function LeagueTable({ entries }: { entries: LeagueEntry[] }) {
  return (
    <ol className="league-table" aria-label="This week" tabIndex={0}>
      {entries.map((e, i) => (
        <li
          key={`${e.nickname}-${i}`}
          className={e.you ? 'league-row league-row--you' : 'league-row'}
        >
          <span className="league-row__place">{e.place ? ordinal(e.place) : ''}</span>
          <Avatar code={e.avatarCode} nickname={e.nickname} size={36} />
          <Who card={e} you={e.you} />
          <span className="league-row__xp">{e.place ? `${e.xp} XP` : 'Not started yet'}</span>
        </li>
      ))}
    </ol>
  );
}

const codeMessage = (err: unknown) => {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 429) return 'Too many tries. Try again later.';
  if (status === 409) return 'You have too many friends or requests waiting right now.';
  return "That code isn't valid. Check it, or ask your friend for a new one.";
};

type AddStep =
  | { step: 'start' }
  | { step: 'code'; code: string }
  | { step: 'check'; requestId: string; friend: FriendCard }
  | { step: 'sent' };

function AddFriend({ api, onDone }: { api: StudentLeagueApi; onDone: () => void }) {
  const [state, setState] = useState<AddStep>({ step: 'start' });
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showCode = async () => {
    setError(null);
    try {
      const { code } = await api.makeCode();
      setState({ step: 'code', code });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'You can make 3 codes a day. Try again tomorrow.'
          : codeMessage(err),
      );
    }
  };
  const check = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const { requestId, friend } = await api.redeem(typed);
      setState({ step: 'check', requestId, friend });
    } catch (err) {
      setError(codeMessage(err));
    }
  };

  if (state.step === 'check') {
    return (
      <div className="stack">
        <p>Is this your friend?</p>
        <p className="league-check">
          <Avatar code={state.friend.avatarCode} nickname={state.friend.nickname} />
          <Who card={state.friend} />
        </p>
        <Button
          onClick={async () => {
            await api.confirm(state.requestId);
            setState({ step: 'sent' });
            onDone();
          }}
        >
          Yes, this is my friend
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await api.cancel(state.requestId);
            setState({ step: 'start' });
            onDone();
          }}
        >
          No, cancel
        </Button>
      </div>
    );
  }
  if (state.step === 'sent') {
    return (
      <p>Now a parent in each family needs to say yes. You'll see your friend here when they do.</p>
    );
  }
  return (
    <div className="stack">
      {state.step === 'code' ? (
        <p>
          Your code: <strong className="league-code">{state.code}</strong>
          <br />
          Tell it to your friend in person. It works once, for 48 hours.
        </p>
      ) : (
        <Button variant="secondary" onClick={showCode}>
          Show my code
        </Button>
      )}
      <form className="stack" onSubmit={check}>
        <label htmlFor="friend-code">Friend's code</label>
        <input
          id="friend-code"
          className="input"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={12}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button type="submit" disabled={typed.trim().length === 0}>
          Check code
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function FriendSheet({
  friend,
  api,
  onClose,
  onChanged,
}: {
  friend: Friend;
  api: StudentLeagueApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'menu' | 'report' | 'done'>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const act = async (run: () => Promise<void>) => {
    await run();
    onChanged();
    onClose();
  };
  return (
    <Sheet open title={friend.nickname} onClose={onClose}>
      <div className="stack">
        <p className="league-check">
          <Avatar code={friend.avatarCode} nickname={friend.nickname} />
          <Who card={friend} />
        </p>
        {friend.sibling ? (
          <p className="secondary-text">
            You're in each other's league because you're in your family.
          </p>
        ) : mode === 'menu' ? (
          <>
            <Button variant="secondary" onClick={() => act(() => api.removeFriend(friend.id))}>
              Remove
            </Button>
            <Button variant="secondary" onClick={() => act(() => api.blockFriend(friend.id))}>
              Block
            </Button>
            <Button variant="danger" onClick={() => setMode('report')}>
              Report
            </Button>
          </>
        ) : mode === 'report' ? (
          <fieldset className="stack">
            <legend>What's wrong?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="league-reason">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {REPORT_REASON_LABELS[r]}
              </label>
            ))}
            <Button
              variant="danger"
              disabled={!reason}
              onClick={async () => {
                if (!reason) return;
                await api.reportFriend(friend.id, reason);
                setMode('done');
                onChanged();
              }}
            >
              Send report
            </Button>
          </fieldset>
        ) : (
          <p>Thanks. A parent will see this, and {friend.nickname} is no longer your friend.</p>
        )}
      </div>
    </Sheet>
  );
}

function FriendsSheet({
  data,
  api,
  onClose,
  onChanged,
}: {
  data: StudentFriendsResponse;
  api: StudentLeagueApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<Friend | null>(null);
  const [hidden, setHidden] = useState(data.hidden);
  const waitingText = {
    confirm: 'Waiting for you to check',
    parents: 'Waiting for parents',
    not_going_ahead: "Didn't go ahead",
  };
  return (
    <>
      <Sheet open={!open} title="Friends" onClose={onClose}>
        <div className="stack">
          <ul className="league-friends" aria-label="Your friends">
            {data.friends.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="league-friend"
                  aria-label={f.nickname}
                  onClick={() => setOpen(f)}
                >
                  <Avatar code={f.avatarCode} nickname={f.nickname} size={36} />
                  <Who card={f} />
                </button>
              </li>
            ))}
          </ul>
          {data.friends.length === 0 && <p className="secondary-text">No friends yet.</p>}
          {data.waiting.length > 0 && (
            <ul className="league-waiting" aria-label="Friend requests">
              {data.waiting.map((w) => (
                <li key={w.requestId}>
                  <span>{w.nickname}</span>
                  <span className="secondary-text">{waitingText[w.status]}</span>
                </li>
              ))}
            </ul>
          )}
          <label className="league-hide">
            <input
              type="checkbox"
              checked={hidden}
              onChange={async (e) => {
                const next = e.target.checked;
                setHidden(next);
                await api.setHidden(next);
                onChanged();
              }}
            />
            Hide me from the league
          </label>
        </div>
      </Sheet>
      {open && (
        <FriendSheet friend={open} api={api} onClose={() => setOpen(null)} onChanged={onChanged} />
      )}
    </>
  );
}

/**
 * The friends league (docs/FRIENDS_LEAGUE.md), reached from Me and the Map rank chip. The table
 * fits one screen; adding and managing friends sits behind sheets.
 */
export function LeagueScreen({ api }: { api: StudentLeagueApi }) {
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const data = useApiResource(
    async () => ({ friends: await api.getFriends(), league: await api.getLeague() }),
    [api, version],
  );
  const [sheet, setSheet] = useState<'add' | 'friends' | null>(null);
  // Keep showing the last data while it refreshes, so an open sheet stays open.
  const last = useRef<{ friends: StudentFriendsResponse; league: LeagueResponse } | null>(null);
  if (data.status === 'ready') last.current = data.data;
  if (!last.current) return data.status === 'ready' ? null : <LoadingOrError resource={data} />;
  const { friends, league } = last.current;

  if (!friends.allowed) {
    return (
      <div className="stack">
        <h1>Friends league</h1>
        <Card>
          <p>
            Ask a parent to turn on friends. Then you can add friends and see this week's league.
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="stack league-page">
      <h1>Friends league</h1>
      <Card className="league-card">
        {league.hidden ? (
          <p>You're hidden from the league. Your friends can't see your XP.</p>
        ) : league.entries.length < 2 ? (
          <p>Add a friend to start a league. It's this week's XP, Monday to Sunday.</p>
        ) : (
          <LeagueTable entries={league.entries} />
        )}
        <p className="secondary-text">
          Friends' XP updates once a day. Only XP from learning counts.
        </p>
      </Card>
      <div className="league-actions">
        <Button onClick={() => setSheet('add')}>Add a friend</Button>
        <Button variant="secondary" onClick={() => setSheet('friends')}>
          Friends
        </Button>
      </div>
      <Sheet open={sheet === 'add'} title="Add a friend" onClose={() => setSheet(null)}>
        <AddFriend api={api} onDone={reload} />
      </Sheet>
      {sheet === 'friends' && (
        <FriendsSheet data={friends} api={api} onClose={() => setSheet(null)} onChanged={reload} />
      )}
    </div>
  );
}

export function LeaguePage() {
  const api = useMemo(
    () => createLeagueApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [],
  );
  return <LeagueScreen api={api} />;
}
