import { Card } from '../../components/Card';
import { useApiResource } from '../../api/useApiResource';
import { LearnItFirst, checkedLinksFor, learnLinksByTopic } from '../learn-links';
import { useStatsApi } from './statsApi';

/**
 * "Worth a look together" (workstream K11): topics the child has found tricky across several
 * days. Parent dashboard only. Nothing at all shows when the list is empty or will not load,
 * so it never reads as a warning.
 */
export function WorthALookCard({ studentId }: { studentId: string }) {
  const api = useStatsApi();
  const loaded = useApiResource(() => api.getWorthALook(studentId), [api, studentId]);
  if (loaded.status !== 'ready' || loaded.data.topics.length === 0) return null;
  return (
    <Card title="Worth a look together">
      <p>These have been tricky for a while. A chat or a look with their teacher may help.</p>
      <ul className="stats-list">
        {loaded.data.topics.map((t) => (
          <li key={t.topicId} className="stats-list__row stats-list__row--wrap">
            <span>
              {t.title}
              <span className="secondary-text">{` · ${t.points} point${t.points === 1 ? '' : 's'}`}</span>
            </span>
            <LearnItFirst links={checkedLinksFor(learnLinksByTopic, t.topicId)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
