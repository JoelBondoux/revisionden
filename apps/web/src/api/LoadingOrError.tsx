import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorRef, refOf } from './ErrorRef';
import { SignInPrompt } from './SignInButtons';
import type { ApiResource } from './useApiResource';
import { isStudentApiPath, unlockPath } from './unlock';

interface LoadingOrErrorProps {
  resource: Exclude<ApiResource<unknown>, { status: 'ready' }>;
}

/** Shared loading message, sign-in prompt and retry UI for any screen that loads data. */
/** Sends a student device whose session ran out to `/unlock`, remembering this page. */
function UnlockRedirect() {
  const location = useLocation();
  return <Navigate to={unlockPath(`${location.pathname}${location.search}`)} replace />;
}

export function LoadingOrError({ resource }: LoadingOrErrorProps) {
  if (resource.status === 'loading') {
    return (
      <p role="status" className="secondary-text">
        Loading…
      </p>
    );
  }
  const { error } = resource;
  if (error.kind === 'http' && error.status === 401) {
    // A student device whose 12-hour session ran out unlocks again with its passkey (I5).
    if (isStudentApiPath(error.apiPath)) return <UnlockRedirect />;
    return (
      <Card>
        <SignInPrompt />
      </Card>
    );
  }
  const offline = error.kind === 'network';
  return (
    <Card>
      <div role="alert">
        <h2>{offline ? "Can't reach RevisionDen" : 'Something went wrong'}</h2>
        <p>
          {offline
            ? 'Check your internet connection, then try again.'
            : 'It is not you, it is us. Please try again in a moment.'}
        </p>
        {!offline && <ErrorRef code={refOf(error)} />}
      </div>
      <Button onClick={resource.retry}>Try again</Button>
    </Card>
  );
}
