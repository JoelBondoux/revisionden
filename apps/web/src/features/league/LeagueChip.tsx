import { useMemo, type ReactNode } from 'react';
import { ordinal } from '@revisionden/core';
import { defaultBaseUrl } from '../../api/ApiContext';
import { useApiResource } from '../../api/useApiResource';
import { LinkChip } from '../../components/links';
import { createLeagueApi, type StudentLeagueApi } from './leagueApi';

/**
 * "You're 2nd this week": a small, self-contained link to the friends league, on Home (owner,
 * 2026-11-26: it moved from the Map when Home landed). It loads its own data and shows the
 * fallback when there is no league to show (friends off or not available, hidden, no friends).
 */
export function LeagueChip({
  api: given,
  fallback = null,
}: {
  api?: Pick<StudentLeagueApi, 'getLeague'>;
  /** Shown instead when there is no league (for example Home's "Friends league Soon"). */
  fallback?: ReactNode;
}) {
  const api = useMemo(
    () =>
      given ??
      createLeagueApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [given],
  );
  const league = useApiResource(() => api.getLeague(), [api]);
  if (league.status === 'loading') return null;
  if (league.status !== 'ready' || league.data.hidden) return <>{fallback}</>;
  const { entries } = league.data;
  const me = entries.find((e) => e.you);
  if (!me || entries.length < 2) return <>{fallback}</>;
  const text = me.place ? `You're ${ordinal(me.place)} this week` : 'League: not started this week';
  return (
    <LinkChip to="/league" className="league-chip">
      {text}
    </LinkChip>
  );
}
