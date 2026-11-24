import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';
import { StudentProvider } from './session/StudentContext';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <StudentProvider>
      <RouterProvider router={router} />
    </StudentProvider>
  );
}
