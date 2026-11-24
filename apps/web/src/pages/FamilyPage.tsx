import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import { useApiResource } from '../api/useApiResource';
import { Avatar } from '../components/Avatar';
import { useStudent } from '../session/StudentContext';

export function FamilyPage() {
  const api = useApi();
  const navigate = useNavigate();
  const { chooseStudent } = useStudent();
  const family = useApiResource(() => api.getFamily(), [api]);

  const choose = (id: string) => {
    chooseStudent(id);
    navigate('/learn');
  };

  return (
    <div className="stack">
      <h1>Who&apos;s revising?</h1>
      {family.status !== 'ready' ? (
        <LoadingOrError resource={family} />
      ) : (
        <ul className="profile-list">
          {family.data.students.map((student) => (
            <li key={student.id}>
              <button type="button" className="profile" onClick={() => choose(student.id)}>
                <Avatar code={student.avatarCode} nickname={student.nickname} size={56} />
                <span className="profile__text">
                  <span className="profile__name">{student.nickname}</span>
                  <span className="secondary-text">Year {student.yearGroup}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link to="/onboarding" className="secondary-text">
        Parents: add or manage children
      </Link>
    </div>
  );
}
