import { useMemo } from 'react';
import { defaultBaseUrl } from '../../api/ApiContext';
import { useApiResource } from '../../api/useApiResource';
import { UsersIcon } from '../../components/icons';
import { ButtonTile } from '../../components/links';
import { createLeagueApi, type LeagueApi } from './leagueApi';

/*
 * Entry points to the friends league that appear only when the server has friends (the API's
 * dev-only FRIENDS_ENABLED flag, lead 2026-11-26). If the server says "not available yet", or
 * anything goes wrong, they show nothing.
 */

function useLeagueApi(given?: LeagueApi) {
  return useMemo(
    () =>
      given ??
      createLeagueApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [given],
  );
}

/** "Friends league" on Me (a ButtonTile). */
export function LeagueTile({ api: given }: { api?: LeagueApi }) {
  const api = useLeagueApi(given);
  const friends = useApiResource(() => api.getFriends(), [api]);
  if (friends.status !== 'ready') return null;
  return <ButtonTile to="/league" icon={<UsersIcon />} label="Friends league" />;
}

/** "Friends" on the child's card in the parent home (a ButtonTile). */
export function ParentFriendsTile({
  api: given,
  studentId,
  nickname,
}: {
  api?: LeagueApi;
  studentId: string;
  nickname: string;
}) {
  const api = useLeagueApi(given);
  const friends = useApiResource(() => api.getChildFriends(studentId), [api, studentId]);
  if (friends.status !== 'ready') return null;
  return (
    <ButtonTile
      to={`/parent/friends/${encodeURIComponent(studentId)}?name=${encodeURIComponent(nickname)}`}
      icon={<UsersIcon />}
      label="Friends"
    />
  );
}

/** True when the API refused because friends are not available on this server yet. */
export const isNotAvailable = (error: { status?: number }) => error.status === 404;
