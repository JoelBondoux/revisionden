import { Link, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';
import { useParentSession } from '../api/signIn';
import { SignInButtons } from '../api/SignInButtons';
import { SignOutButton } from '../api/SignOutButton';

export function WelcomePage() {
  const [params] = useSearchParams();
  const session = useParentSession();

  return (
    <div className="welcome stack">
      <div className="welcome__hero">
        <Pip size={140} label="Pip the fox" />
        <h1 className="welcome__title">RevisionDen</h1>
        <p className="welcome__tagline">Revision that finds the gaps.</p>
      </div>
      <Card title="Parents">
        {session === 'signed-in' ? (
          <div className="stack">
            <p>You are signed in.</p>
            <ButtonLink to="/family" block>
              Continue
            </ButtonLink>
            <SignOutButton />
          </div>
        ) : (
          <div className="stack">
            {params.has('error') && <p role="alert">Sign-in did not finish. Please try again.</p>}
            <SignInButtons returnTo="/family" />
          </div>
        )}
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
