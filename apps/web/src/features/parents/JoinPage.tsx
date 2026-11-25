import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { SignInButtons } from '../../api/SignInButtons';
import { ParentsApiError, messageOf, useParentsApi, type ParentsApi } from './parentsApi';

/** /join?code=…: the second parent joins the family with the invite code (B3). */
export function JoinPage({ api: given }: { api?: ParentsApi }) {
  const fromContext = useParentsApi();
  const api = given ?? fromContext;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.join(code.trim());
      navigate('/parent');
    } catch (err) {
      if (err instanceof ParentsApiError && err.status === 401) setNeedsSignIn(true);
      else setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <h1>Join your family</h1>
      <p>
        The other parent invited you. You will both be able to see and manage your children&apos;s
        revision, with equal control.
      </p>
      {needsSignIn && (
        <div className="stack">
          <p>Sign in with your own Google or Microsoft account first.</p>
          <SignInButtons returnTo={`/join?code=${encodeURIComponent(code.trim())}`} />
        </div>
      )}
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
      <label className="field">
        <span>Invite code</span>
        <input value={code} onChange={(e) => setCode(e.currentTarget.value)} autoComplete="off" />
      </label>
      <Button disabled={busy || code.trim() === ''} onClick={() => void join()}>
        Join the family
      </Button>
    </div>
  );
}
