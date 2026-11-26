import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ShareLink } from '../../pwa/ShareLink';
import { browserShareApis, type ShareApis } from '../../pwa/share';
import {
  longDate,
  messageOf,
  useParentsApi,
  type FamilyParents,
  type ParentInvite,
  type ParentsApi,
} from './parentsApi';

/** The message sent with a second-parent invite: plain, with no child's details. */
export const inviteMessage = (link: string) =>
  `Join our family on RevisionDen as a parent: ${link}`;

/**
 * Two parents (B3): who the parents are, inviting a second parent, removing the other parent
 * and deleting the whole family (which needs both parents when there are two).
 */
export function ParentsPanel({
  api: given,
  onDeleted,
  share = browserShareApis(typeof navigator === 'undefined' ? undefined : navigator),
}: {
  api?: ParentsApi;
  /** Injected in tests; defaults to the device's share sheet and clipboard (I8). */
  share?: ShareApis;
  /** Called once the family account is deleted. */
  onDeleted: () => void;
}) {
  const fromContext = useParentsApi();
  const api = given ?? fromContext;
  const [state, setState] = useState<FamilyParents>();
  const [invite, setInvite] = useState<ParentInvite>();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<'remove' | 'delete' | null>(null);
  const [waitingFor, setWaitingFor] = useState<string>();

  const load = useCallback(() => {
    api.parents().then(setState, (err: unknown) => setError(messageOf(err)));
  }, [api]);
  useEffect(load, [load]);

  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const other = state?.parents.find((p) => !p.you);
  const request = state?.deletionRequest ?? null;

  return (
    <Card title="Parents">
      <div className="stack">
        {error && (
          <p role="alert" className="field__error">
            {error}
          </p>
        )}
        {state && (
          <ul className="link-list" aria-label="Parents">
            {state.parents.map((p) => (
              <li key={p.position}>{p.you ? `${p.label} (you)` : p.label}</li>
            ))}
          </ul>
        )}
        <p className="secondary-text">
          Two parents can each have their own sign-in, with the same control. The activity log shows
          who changed what, as Parent 1 or Parent 2.
        </p>

        {state?.canInvite && !invite && (
          <Button
            variant="secondary"
            onClick={() => void run(async () => setInvite(await api.invite()))}
          >
            Invite a second parent
          </Button>
        )}
        {invite && (
          <div className="stack">
            <p>
              Give the other parent this code: <strong>{invite.code}</strong>
            </p>
            <label className="field">
              <span>Invite link</span>
              <input readOnly value={invite.link} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <ShareLink text={inviteMessage(invite.link)} share={share} />
            <p className="secondary-text">
              It works once, until {longDate(invite.expiresAt)}. They sign in with their own Google
              or Microsoft account.
            </p>
          </div>
        )}

        {other && confirming !== 'remove' && (
          <Button variant="secondary" onClick={() => setConfirming('remove')}>
            {`Remove ${other.label}`}
          </Button>
        )}
        {other && confirming === 'remove' && (
          <div className="stack">
            <p>{`${other.label} will lose access straight away. Your children's data stays.`}</p>
            <Button
              variant="danger"
              onClick={() =>
                void run(async () => {
                  await api.removeParent(other.position);
                  setConfirming(null);
                  load();
                })
              }
            >
              {`Yes, remove ${other.label}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        )}

        {request && !request.byYou && (
          <div className="stack" role="status">
            <p>{`${request.by ?? 'The other parent'} asked to delete the family account on ${longDate(request.at)}.`}</p>
            <Button
              variant="danger"
              onClick={() =>
                void run(async () => {
                  const res = await api.requestDeletion();
                  if (res.deleted) onDeleted();
                })
              }
            >
              Confirm deletion
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void run(async () => {
                  await api.cancelDeletion();
                  load();
                })
              }
            >
              Keep the account
            </Button>
          </div>
        )}
        {(waitingFor || request?.byYou) && (
          <div className="stack" role="status">
            <p>{`Waiting for ${waitingFor ?? other?.label ?? 'the other parent'} to confirm deleting the family account.`}</p>
            <Button
              variant="secondary"
              onClick={() =>
                void run(async () => {
                  await api.cancelDeletion();
                  setWaitingFor(undefined);
                  load();
                })
              }
            >
              Cancel deletion
            </Button>
          </div>
        )}
        {!request && !waitingFor && confirming !== 'delete' && (
          <Button variant="secondary" onClick={() => setConfirming('delete')}>
            Delete the family account
          </Button>
        )}
        {!request && !waitingFor && confirming === 'delete' && (
          <div className="stack">
            <p>
              This deletes every child, all their learning and both parents' sign-ins. It cannot be
              undone. {other ? `${other.label} must confirm it too.` : ''}
            </p>
            <Button
              variant="danger"
              onClick={() =>
                void run(async () => {
                  const res = await api.requestDeletion();
                  setConfirming(null);
                  if (res.deleted) onDeleted();
                  else setWaitingFor(res.waitingFor);
                })
              }
            >
              Yes, delete everything
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
