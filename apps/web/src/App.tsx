import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';
import { StudentProvider } from './session/StudentContext';
import { SoundProvider } from './features/sound';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <SoundProvider>
      <StudentProvider>
        <RouterProvider router={router} />
      </StudentProvider>
    </SoundProvider>
  );
}
