import { useOnlineStatus } from './useOnlineStatus';

/** A live region that tells the user when they lose their connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite" className={online ? undefined : 'offline-banner'}>
      {!online && "You're offline. Some things won't load until you reconnect."}
    </div>
  );
}
