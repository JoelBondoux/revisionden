import { useContext, useState } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { maskIdsInPath, type ErrorReport } from '@revisionden/core';
import { Button } from '../components/Button';
import { browserFamily } from '../features/feedback/details';
import { CURRENT_BUILD } from '../pwa/updates';
import { defaultBaseUrl } from './ApiContext';

/** What an error screen knows about the failure: its code, and the API call that failed. */
export interface ErrorDetails {
  ref: string;
  status?: number;
  apiPath?: string;
}

/** The reference code (and failing API call) of any error, when it has one. */
export function refOf(error: unknown): ErrorDetails | undefined {
  const e = error as { ref?: unknown; status?: unknown; apiPath?: unknown } | null;
  if (typeof e?.ref !== 'string') return undefined;
  return {
    ref: e.ref,
    ...(typeof e.status === 'number' && e.status > 0 ? { status: e.status } : {}),
    ...(typeof e.apiPath === 'string' ? { apiPath: e.apiPath } : {}),
  };
}

/** Sends the anonymous error report (`POST /v1/error-reports`); resolves to whether it arrived. */
export async function sendErrorReport(
  report: ErrorReport,
  baseUrl = defaultBaseUrl(import.meta.env, window.location.origin),
): Promise<boolean> {
  try {
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const res = await fetch(new URL('v1/error-reports', root), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(report),
    });
    return res.ok;
  } catch {
    return false;
  }
}

type SendState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * The short reference code shown with "Something went wrong", and a one-tap "Send error report"
 * button. The report is anonymous: the code, this screen and the failing API call with ids
 * masked, the app build, the browser family, online or not, and the time. No typing, no names.
 */
export function ErrorRef({ code }: { code: ErrorDetails | string | undefined }) {
  // The router's page when there is one (components can be shown outside it, e.g. in tests).
  const routed = useContext(UNSAFE_LocationContext) as { location?: { pathname: string } } | null;
  const pathname = routed?.location?.pathname ?? window.location.pathname;
  const [state, setState] = useState<SendState>('idle');
  if (!code) return null;
  const details = typeof code === 'string' ? { ref: code } : code;

  const send = async () => {
    setState('sending');
    const ok = await sendErrorReport({
      ref: details.ref,
      screen: maskIdsInPath(pathname),
      ...(details.apiPath ? { apiPath: details.apiPath } : {}),
      ...(details.status !== undefined ? { status: details.status } : {}),
      build: CURRENT_BUILD,
      browser: browserFamily(navigator.userAgent) as ErrorReport['browser'],
      online: navigator.onLine,
      at: new Date().toISOString(),
    });
    setState(ok ? 'sent' : 'failed');
  };

  return (
    <div className="error-ref stack">
      <p className="secondary-text">
        Reference code: <code>{details.ref}</code>
      </p>
      {state === 'sent' ? (
        <p role="status">Thanks, we&apos;re on it.</p>
      ) : (
        <>
          <Button variant="secondary" disabled={state === 'sending'} onClick={() => void send()}>
            Send error report
          </Button>
          {state === 'failed' && (
            <p role="status">The report could not be sent. Please try again later.</p>
          )}
        </>
      )}
    </div>
  );
}
