import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'revisionden.studentId';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StudentContextValue {
  studentId: string | null;
  chooseStudent: (id: string) => void;
}

const StudentContext = createContext<StudentContextValue>({
  studentId: null,
  chooseStudent: () => {},
});

function safeRead(storage: KeyValueStorage | undefined): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Remembers which student is using this device. A convenience only: the real device link
 * (QR and passkey) comes from workstream B.
 */
export function StudentProvider({
  storage = browserStorage(),
  children,
}: {
  storage?: KeyValueStorage;
  children: ReactNode;
}) {
  const [studentId, setStudentId] = useState(() => safeRead(storage));

  const chooseStudent = useCallback(
    (id: string) => {
      setStudentId(id);
      try {
        storage?.setItem(STORAGE_KEY, id);
      } catch {
        // Storage blocked (private mode): keep the choice for this visit only.
      }
    },
    [storage],
  );

  const value = useMemo(() => ({ studentId, chooseStudent }), [studentId, chooseStudent]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  return useContext(StudentContext);
}
