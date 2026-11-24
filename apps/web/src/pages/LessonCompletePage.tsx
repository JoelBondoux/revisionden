import { useLocation } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';

export interface LessonResults {
  xpEarned: number;
  correct: number;
  total: number;
}

function isLessonResults(value: unknown): value is LessonResults {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return [v.xpEarned, v.correct, v.total].every((n) => typeof n === 'number');
}

export function LessonCompletePage() {
  const { state } = useLocation();
  const results = isLessonResults(state) ? state : null;

  return (
    <div className="complete stack">
      <Pip size={140} mood="cheer" label="Pip cheering" />
      <h1>Lesson complete!</h1>
      {results && (
        <div className="complete__stats">
          <Card className="stat stat--gold">
            <p className="stat__label">XP earned</p>
            <p className="stat__value">+{results.xpEarned} XP</p>
          </Card>
          <Card className="stat stat--success">
            <p className="stat__label">Score</p>
            <p className="stat__value">
              {results.correct} of {results.total} correct
            </p>
          </Card>
        </div>
      )}
      <ButtonLink to="/learn" block>
        Continue
      </ButtonLink>
    </div>
  );
}
