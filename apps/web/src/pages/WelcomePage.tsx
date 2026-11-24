import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';

export function WelcomePage() {
  const navigate = useNavigate();
  // TODO(workstream B): replace with Better Auth sign-in. For now, go straight to the mock family.
  const signIn = () => navigate('/family');

  return (
    <div className="welcome stack">
      <div className="welcome__hero">
        <Pip size={140} label="Pip the fox" />
        <h1 className="welcome__title">RevisionDen</h1>
        <p className="welcome__tagline">Revision that finds the gaps.</p>
      </div>
      <Card title="Parents">
        <div className="stack">
          <Button block onClick={signIn}>
            Continue with Google
          </Button>
          <Button block variant="secondary" onClick={signIn}>
            Continue with Microsoft
          </Button>
        </div>
      </Card>
      <Card title="Students">
        <p className="secondary-text">
          Ask a parent to show you the QR code in their RevisionDen, then scan it with this
          device&apos;s camera.
        </p>
      </Card>
    </div>
  );
}
