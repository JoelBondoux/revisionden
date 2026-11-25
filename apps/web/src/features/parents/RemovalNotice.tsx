import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { longDate, useParentsApi, type ParentsApi } from './parentsApi';

/** Shown once to a parent the other parent removed; after OK they start again on their own. */
export function RemovalNotice({ api: given, onDone }: { api?: ParentsApi; onDone: () => void }) {
  const fromContext = useParentsApi();
  const api = given ?? fromContext;
  const [removedAt, setRemovedAt] = useState<string>();

  useEffect(() => {
    let live = true;
    api.removalNotice().then(
      (n) => live && n.removed && setRemovedAt(n.removedAt ?? new Date().toISOString()),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  if (!removedAt) return null;
  return (
    <div role="alert" className="stack">
      <p>
        The other parent removed you from the family on {longDate(removedAt)}. You can no longer see
        the children&apos;s progress. You can start your own family account if you need one.
      </p>
      <Button
        onClick={() =>
          void api.seenRemovalNotice().then(() => {
            setRemovedAt(undefined);
            onDone();
          })
        }
      >
        OK
      </Button>
    </div>
  );
}
