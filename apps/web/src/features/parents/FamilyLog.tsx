import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { longDate, useParentsApi, type FamilyEvents, type ParentsApi } from './parentsApi';

/** The family activity log: what changed, by "Parent 1" or "Parent 2" (never names). */
export function FamilyLog({ api: given }: { api?: ParentsApi }) {
  const fromContext = useParentsApi();
  const api = given ?? fromContext;
  const [log, setLog] = useState<FamilyEvents>();

  useEffect(() => {
    let live = true;
    api.events().then(
      (l) => live && setLog(l),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  if (!log) return null;
  const markSeen = async () => {
    await api.markSeen();
    setLog({ events: log.events.map((e) => ({ ...e, isNew: false })), newFromOtherParent: 0 });
  };

  return (
    <Card title="Family activity">
      <div className="stack">
        {log.newFromOtherParent > 0 && (
          <div className="stack" role="status">
            <p>
              <strong>
                {log.newFromOtherParent === 1
                  ? '1 new change by the other parent'
                  : `${log.newFromOtherParent} new changes by the other parent`}
              </strong>
            </p>
            <Button variant="secondary" onClick={() => void markSeen()}>
              Mark as seen
            </Button>
          </div>
        )}
        {log.events.length === 0 ? (
          <p className="secondary-text">No changes yet.</p>
        ) : (
          <ul className="link-list" aria-label="Changes">
            {log.events.slice(0, 20).map((e) => (
              <li key={e.id}>
                <span>{`${e.you ? 'You' : (e.by ?? 'Someone')} ${e.what}`}</span>{' '}
                <span className="secondary-text">{longDate(e.createdAt)}</span>
                {e.isNew && <span className="secondary-text"> (new)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
