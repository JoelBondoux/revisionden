import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorRef, refOf } from './ErrorRef';
import { SignInPrompt } from './SignInButtons';
import type { ApiResource } from './useApiResource';

interface LoadingOrErrorProps {
  resource: Exclude<ApiResource<unknown>, { status: 'ready' }>;
}

/** Shared loading message, sign-in prompt and retry UI for any screen that loads data. */
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
