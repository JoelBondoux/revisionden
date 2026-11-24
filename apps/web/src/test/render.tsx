import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../routes';
import { StudentProvider } from '../session/StudentContext';

interface RenderRouteOptions {
  /** The student already chosen on this device; `null` for nobody. */
  studentId?: string | null;
}

/** Renders the whole app at a given path, as a user arriving there would see it. */
export function renderRoute(path: string, { studentId = 'student-1' }: RenderRouteOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const storage = new Map<string, string>(studentId ? [['revisionden.studentId', studentId]] : []);
  const view = render(
    <StudentProvider
      storage={{
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => void storage.set(k, v),
      }}
    >
      <RouterProvider router={router} />
    </StudentProvider>,
  );
  return { ...view, router };
}
