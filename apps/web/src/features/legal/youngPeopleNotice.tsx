import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Markdown } from './Markdown';
import { usePolicyLibrary } from './PolicyLibraryContext';
import { defaultPolicyLibrary } from './policyFiles';
import './legal.css';

/** Which version of the young people's notice this device has shown (docs/LEGAL.md). */
export const NOTICE_KEY = 'revisionden.youngPeopleNotice';
const NOTICE = 'privacy-for-young-people';

export interface NoticeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): NoticeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function seenVersion(storage: NoticeStorage | undefined): string | null {
  try {
    return storage?.getItem(NOTICE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Where a newly linked student device goes: the notice once per version, then learning. */
export function afterLinkPath(
  version: string | null | undefined = defaultPolicyLibrary.version(NOTICE),
  storage: NoticeStorage | undefined = browserStorage(),
): string {
  if (!version) return '/learn';
  return seenVersion(storage) === version ? '/learn' : '/welcome/privacy';
}

/** The young people's notice in plain English, shown when a device is first linked. */
export function YoungPeopleNoticePage({ storage = browserStorage() }: { storage?: NoticeStorage }) {
  const notice = usePolicyLibrary().get(NOTICE);
  const navigate = useNavigate();
  if (!notice) return <Navigate to="/learn" replace />;

  const done = () => {
    try {
      storage?.setItem(NOTICE_KEY, notice.version);
    } catch {
      // Storage blocked (private mode): the notice shows again next time, which is fine.
    }
    navigate('/learn');
  };

  return (
    <article className="policy stack">
      <h1>{notice.title}</h1>
      <div className="policy__summary">
        <Markdown text={notice.plainEnglish} headingOffset={1} />
      </div>
      <p>
        <Link to={`/legal/${NOTICE}`}>Read the full notice</Link>
      </p>
      <Button block onClick={done}>
        Got it
      </Button>
    </article>
  );
}
