import { useSearchParams } from 'react-router-dom';
import { LinkButton, LinkChip } from '../components/links';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';
import { useParentSession } from '../api/signIn';
import { SignInButtons } from '../api/SignInButtons';
import { SignOutButton } from '../api/SignOutButton';
import { StudentUnlock } from '../features/onboarding/StudentUnlock';

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
            <LinkButton to="/family" block>
              Continue
            </LinkButton>
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
        <div className="stack">
          <StudentUnlock label="I'm a student: unlock with my passkey" />
          <p className="secondary-text">
            New on this device? Ask a parent to show you the QR code in their RevisionDen, then scan
            it with this device&apos;s camera.
          </p>
        </div>
      </Card>
      <footer className="welcome__footer secondary-text">
        <LinkChip to="/legal">Policies</LinkChip> <LinkChip to="/about">About</LinkChip>
      </footer>
    </div>
  );
}
