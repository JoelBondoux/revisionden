import { Link, useSearchParams } from 'react-router-dom';
import { Pip } from '../../components/Pip';
import { StudentUnlock } from './StudentUnlock';

/**
 * `/unlock`: where a student comes when their 12-hour device session has run out (or from the
 * welcome page). After unlocking they go back to `returnTo`, or to the topic map.
 */
export function UnlockPage() {
  const [params] = useSearchParams();
  return (
    <div className="stack">
      <Pip size={96} label="Pip the fox" />
      <h1>Unlock RevisionDen</h1>
      <p>Use your face, fingerprint or screen lock to carry on revising.</p>
      <StudentUnlock label="Unlock with my passkey" returnTo={params.get('returnTo')} />
      <p className="secondary-text">
        Not a student? <Link to="/">Parents sign in here</Link>.
      </p>
    </div>
  );
}
