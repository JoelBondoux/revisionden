import { useMemo } from 'react';
import { ordinal } from '@revisionden/core';
import { defaultBaseUrl } from '../../api/ApiContext';
import { useApiResource } from '../../api/useApiResource';
import { LinkChip } from '../../components/links';
import { createLeagueApi, type StudentLeagueApi } from './leagueApi';

/**
 * "You're 2nd this week": a small, self-contained link to the friends league. It sits on the Map
 * for now and moves to Home when that lands (owner, 2026-11-26), so it loads its own data and
 * shows nothing at all when there is no league to show (friends off, hidden, no friends, error).
 */
export function LeagueChip({ api: given }: { api?: Pick<StudentLeagueApi, 'getLeague'> }) {
  const api = useMemo(
    () =>
      given ??
      createLeagueApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [given],
  );
  const league = useApiResource(() => api.getLeague(), [api]);
  if (league.status !== 'ready' || league.data.hidden) return null;
  const { entries } = league.data;
  const me = entries.find((e) => e.you);
  if (!me || entries.length < 2) return null;
  const text = me.place ? `You're ${ordinal(me.place)} this week` : 'League: not started this week';
  return (
    <LinkChip to="/league" className="league-chip">
      {text}
    </LinkChip>
  );
}
