import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './client';

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError; retry: () => void }
  | { status: 'ready'; data: T };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('network', String(error));
}

/** Loads data once per change of `deps`; exposes a retry on failure. */
export function useApiResource<T>(load: () => Promise<T>, deps: DependencyList): ApiResource<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ApiResource<T>>({ status: 'loading' });
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load().then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', error: toApiError(error), retry }),
    );
    return () => {
      cancelled = true;
    };
    // Callers pass their own deps, as with useEffect.
  }, [...deps, attempt]);

  return state;
}
