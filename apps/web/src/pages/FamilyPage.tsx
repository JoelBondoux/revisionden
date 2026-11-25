import { Link, Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import { SignOutButton } from '../api/SignOutButton';
import { useApiResource } from '../api/useApiResource';
import { Avatar } from '../components/Avatar';
import { ChatIcon, HomeIcon, UsersIcon } from '../components/icons';
import { LinkChip, LinkTile } from '../components/links';

/**
 * The signed-in parent's children. Tapping a child opens the parent home with that child chosen
 * (workstream P); it never opens student screens, which only run on the child's own linked
 * device (product owner, 2026-11-25).
 */
export function FamilyPage() {
  const api = useApi();
  const family = useApiResource(() => api.getFamily(), [api]);

  return (
    <div className="stack">
      <h1>Who&apos;s revising?</h1>
      {family.status === 'ready' && family.data.children.length === 0 ? (
        <Navigate to="/onboarding" replace />
      ) : family.status !== 'ready' ? (
        <LoadingOrError resource={family} />
      ) : (
        <ul className="profile-list">
          {family.data.children.map(({ student }) => {
            const id = encodeURIComponent(student.id);
            return (
              <li key={student.id} className="stack">
                <Link to={`/parent?student=${id}`} className="profile">
                  <Avatar code={student.avatarCode} nickname={student.nickname} size={56} />
                  <span className="profile__text">
                    <span className="profile__name">{student.nickname}</span>
                    <span className="secondary-text">Year {student.yearGroup}</span>
                  </span>
                </Link>
                <span className="profile__actions">
                  <LinkChip
                    to={`/family/${id}/rewards`}
                    aria-label={`Rewards you set for ${student.nickname}`}
                  >
                    Rewards you set
                  </LinkChip>
                  <LinkChip
                    to={`/onboarding?link=${id}`}
                    aria-label={`Link a device for ${student.nickname}`}
                  >
                    Link a device
                  </LinkChip>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="link-tiles">
        <li>
          <LinkTile
            to="/parent"
            icon={<HomeIcon />}
            title="Parent home"
            description="Stats, rewards you set and reminders"
          />
        </li>
        <li>
          <LinkTile
            to="/feedback/family"
            icon={<ChatIcon />}
            title="Family feedback"
            description="What your family has sent us"
          />
        </li>
        <li>
          <LinkTile
            to="/onboarding"
            icon={<UsersIcon />}
            title="Parents: add or manage children"
            description="Profiles, subjects and device links"
          />
        </li>
      </ul>
      {family.status === 'ready' && <SignOutButton />}
    </div>
  );
}
