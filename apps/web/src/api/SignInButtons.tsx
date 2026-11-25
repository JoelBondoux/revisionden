import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { ErrorRef, refOf } from './ErrorRef';
import { startSignIn } from './signIn';
import { useSignInProviders, type SignInProvider } from './signInProviders';

/**
 * "Continue with Google / Microsoft" for the providers the API has set up. After sign-in the
 * parent comes back to `returnTo` (by default, the page they are on).
 */
export function SignInButtons({ returnTo }: { returnTo?: string }) {
  const location = useLocation();
  const providers = useSignInProviders();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ ref: string | undefined } | null>(null);
  const target = returnTo ?? `${location.pathname}${location.search}`;

  const signIn = async (provider: SignInProvider) => {
    setBusy(true);
    setFailure(null);
    try {
      await startSignIn(provider, target);
    } catch (err) {
      setFailure({ ref: refOf(err) });
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {failure && (
        <div role="alert">
          <p>Sign-in could not start. Please try again.</p>
          <ErrorRef code={failure.ref} />
        </div>
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
  );
}

/** Shown wherever the API says the parent is signed out (401). */
export function SignInPrompt() {
  return (
    <div className="stack">
      <div role="alert">
        <h2>Please sign in</h2>
        <p>
          You are signed out. Parents: sign in to carry on. Students: ask a parent to link this
          device.
        </p>
      </div>
      <SignInButtons />
    </div>
  );
}
