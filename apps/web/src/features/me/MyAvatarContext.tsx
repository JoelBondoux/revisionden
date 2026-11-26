import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useOnboardingApi } from '../onboarding/OnboardingApiContext';

/** The student's own look, shared by the nav's Me item and the Me page (W9). */
export interface MyAvatar {
  /** Null while loading or if it could not be read. */
  code: string | null;
  nickname: string | null;
  earnedRewardIds: readonly string[];
  /** Saves a new look; the nav and the Me page show it as soon as the server says yes. */
  save: (code: string) => Promise<void>;
  /** Re-reads which items are unlocked (a reward may have been earned since the page loaded). */
  refreshUnlocks: () => void;
}

const Context = createContext<MyAvatar | null>(null);

interface Loaded {
  code: string | null;
  nickname: string | null;
  earnedRewardIds: readonly string[];
}

const EMPTY: Loaded = { code: null, nickname: null, earnedRewardIds: [] };

/** Loads the student's avatar and nickname once for the student app pages. */
export function MyAvatarProvider({
  studentId,
  children,
}: {
  studentId: string;
  children: ReactNode;
}) {
  const api = useOnboardingApi();
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setLoaded(EMPTY);
    api.getMyAvatar().then(
      ({ avatarCode, earnedRewardIds }) =>
        !cancelled && setLoaded((l) => ({ ...l, code: avatarCode, earnedRewardIds })),
      () => undefined,
    );
    api.getMe().then(
      ({ nickname }) => !cancelled && setLoaded((l) => ({ ...l, nickname })),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api, studentId]);

  const save = useCallback(
    async (code: string) => {
      const student = await api.saveMyAvatar(code);
      setLoaded((l) => ({ ...l, code: student.avatarCode, nickname: student.nickname }));
    },
    [api],
  );

  const refreshUnlocks = useCallback(() => {
    api.getMyAvatar().then(
      ({ earnedRewardIds }) => setLoaded((l) => ({ ...l, earnedRewardIds })),
      () => undefined,
    );
  }, [api]);

  const value = useMemo(
    () => ({ ...loaded, save, refreshUnlocks }),
    [loaded, save, refreshUnlocks],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The student's own avatar, or null where there is no student (a parent, or signed out). */
export function useMyAvatar(): MyAvatar | null {
  return useContext(Context);
}
