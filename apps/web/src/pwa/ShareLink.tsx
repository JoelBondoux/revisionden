import { useState } from 'react';
import { Button } from '../components/Button';
import { isShareCancelled, type ShareApis } from './share';

/**
 * A big "Share link" button that opens the device's own share sheet, where it has one; Copy link
 * otherwise, or if sharing fails. Closing the share sheet without sharing does nothing. Callers
 * still show the link or code itself, for devices with neither.
 */
export function ShareLink({ text, share }: { text: string; share: ShareApis }) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const onShare = () =>
    share.share!({ text }).then(
      () => undefined,
      (err: unknown) => {
        if (!isShareCancelled(err)) setFailed(true);
      },
    );
  const onCopy = () =>
    share.copy!(text).then(
      () => setCopied(true),
      () => undefined,
    );

  const canCopy = share.copy && (!share.share || failed);
  return (
    <>
      {share.share && (
        <Button block onClick={onShare}>
          Share link
        </Button>
      )}
      {failed && (
        <p role="alert" className="field__error">
          {share.copy ? "Sharing didn't work. Copy the link instead." : "Sharing didn't work."}
        </p>
      )}
      {canCopy && (
        <Button variant="secondary" onClick={onCopy}>
          Copy link
        </Button>
      )}
      {copied && <p aria-live="polite">Copied</p>}
    </>
  );
}
