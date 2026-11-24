import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { defaultBaseUrl } from '../../api/ApiContext';
import { ButtonLink } from '../../components';
import { ParentRewardsPanel } from './ParentRewardsPanel';
import { createRewardsApi } from './rewardsApi';

/** Parent screen for one child's real-world rewards (/family/:studentId/rewards). */
export function ParentRewardsPage() {
  const { studentId = '' } = useParams();
  const state = useLocation().state as { nickname?: string } | null;
  const api = useMemo(
    () => createRewardsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [],
  );
  return (
    <div className="stack">
      <h1>Rewards</h1>
      <ParentRewardsPanel
        api={api}
        studentId={studentId}
        nickname={state?.nickname ?? 'your child'}
      />
      <ButtonLink to="/onboarding" variant="secondary" block>
        Back to the family
      </ButtonLink>
    </div>
  );
}
