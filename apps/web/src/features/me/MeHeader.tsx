import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { AvatarBuilder } from '../avatar/AvatarBuilder';
import { useMyAvatar } from './MyAvatarContext';
import './me.css';

/**
 * The top of the Me page (W9): the student's avatar, large, their nickname, and Edit my avatar.
 * Editing reuses E's avatar builder in a sheet. Save sends the look to the server, which only
 * checks that every item is unlocked (no parent approval, no rate limit); Cancel or Escape asks
 * first if anything changed. The nav's Me item shares the same look, so it changes at once.
 */
export function MeHeader() {
  const avatar = useMyAvatar();
  const [draft, setDraft] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const askRef = useRef<HTMLDivElement>(null);

  // The question takes the focus, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (asking) askRef.current?.querySelector('button')?.focus();
  }, [asking]);

  const close = useCallback(() => {
    setDraft(null);
    setAsking(false);
    setError(undefined);
  }, []);

  // Kept stable while the student edits: the Sheet moves focus to itself whenever its onClose
  // changes, which would throw keyboard users back to the top after every pick (Codex P2).
  const latest = useRef({ draft, code: avatar?.code });
  latest.current = { draft, code: avatar?.code };
  const requestClose = useCallback(() => {
    const { draft: current, code } = latest.current;
    if (current !== null && current !== code) setAsking(true);
    else close();
  }, [close]);

  if (!avatar || !avatar.code) return null;
  const nickname = avatar.nickname ?? '';

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    setError(undefined);
    try {
      await avatar.save(draft);
      close();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="me-header" aria-label="My avatar">
      <Avatar code={avatar.code} nickname={nickname || 'Your'} size={96} />
      <div className="me-header__text">
        {nickname && <p className="me-header__name">{nickname}</p>}
        <Button
          variant="secondary"
          onClick={() => {
            setSaved(false);
            setDraft(avatar.code);
            // A reward earned since the page loaded (say, in a flashcard session) unlocks items.
            avatar.refreshUnlocks();
          }}
        >
          Edit my avatar
        </Button>
        <p role="status" className="secondary-text me-header__saved">
          {saved ? 'Avatar saved.' : ''}
        </p>
      </div>

      <Sheet open={draft !== null} title="Edit my avatar" onClose={requestClose}>
        {draft !== null && (
          <AvatarBuilder
            code={draft}
            nickname={nickname}
            earnedRewardIds={avatar.earnedRewardIds}
            onChange={setDraft}
          />
        )}
        {error && (
          <p role="alert" className="field__error">
            {error}
          </p>
        )}
        {asking ? (
          <div
            ref={askRef}
            role="alertdialog"
            aria-labelledby="me-discard"
            className="me-header__ask"
          >
            <p id="me-discard" className="me-header__name">
              Throw away your changes?
            </p>
            <Button block onClick={() => setAsking(false)}>
              Keep editing
            </Button>
            <Button block variant="secondary" onClick={close}>
              Throw away
            </Button>
          </div>
        ) : (
          <div className="me-header__actions">
            <Button block onClick={save} disabled={saving}>
              Save
            </Button>
            <Button block variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
