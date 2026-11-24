import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../routes';

/** Renders the whole app at a given path, as a user arriving there would see it. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}
