import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';
import { defaultBaseUrl } from '../api/ApiContext';
import { ErrorRef, refOf } from '../api/ErrorRef';
import { startSignIn } from '../api/signIn';
import { useSignInProviders, type SignInProvider } from '../api/signInProviders';

const goTo = (url: string) => window.location.assign(url);

interface WelcomePageProps {
  /** Leaves the app for the sign-in provider; tests pass a spy. */
  redirect?: (url: string) => void;
}

export function WelcomePage({ redirect = goTo }: WelcomePageProps) {
  const providers = useSignInProviders();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ ref: string | undefined } | null>(null);
  const returnedWithError = params.has('error');

  const signIn = async (provider: SignInProvider) => {
    setBusy(true);
    setFailure(null);
    try {
      await startSignIn(provider, {
        baseUrl: defaultBaseUrl(import.meta.env, window.location.origin),
        webOrigin: window.location.origin,
        redirect,
      });
    } catch (err) {
      setFailure({ ref: refOf(err) });
      setBusy(false);
    }
  };

  return (
    <div className="welcome stack">
      <div className="welcome__hero">
        <Pip size={140} label="Pip the fox" />
        <h1 className="welcome__title">RevisionDen</h1>
        <p className="welcome__tagline">Revision that finds the gaps.</p>
      </div>
      <Card title="Parents">
        <div className="stack">
          {failure ? (
            <div role="alert">
              <p>Sign-in could not start. Please try again.</p>
              <ErrorRef code={failure.ref} />
            </div>
          ) : (
            returnedWithError && <p role="alert">Sign-in did not finish. Please try again.</p>
          )}
          {providers?.includes('google') && (
            <Button block disabled={busy} onClick={() => void signIn('google')}>
              Continue with Google
            </Button>
          )}
          {providers?.includes('microsoft') && (
            <Button
              block
              disabled={busy}
              variant={providers.includes('google') ? 'secondary' : 'primary'}
              onClick={() => void signIn('microsoft')}
            >
              Continue with Microsoft
            </Button>
          )}
        </div>
      </Card>
      <Card title="Students">
        <p className="secondary-text">
          Ask a parent to show you the QR code in their RevisionDen, then scan it with this
          device&apos;s camera.
        </p>
      </Card>
      <footer className="welcome__footer secondary-text">
        <Link to="/legal">Policies</Link> · <Link to="/about">About</Link>
      </footer>
    </div>
  );
}
