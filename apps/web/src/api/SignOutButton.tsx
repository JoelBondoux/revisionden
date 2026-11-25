import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { signOut } from './signIn';

/** Ends the parent's session and goes back to the welcome page. */
export function SignOutButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    // Even if the API cannot be reached, leave the parent screens.
    await signOut().catch(() => undefined);
    navigate('/', { replace: true });
  };
  return (
    <Button variant="secondary" disabled={busy} onClick={() => void run()}>
      Sign out
    </Button>
  );
}
