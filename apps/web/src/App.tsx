import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';
import { UpdateBanner } from './pwa/updates';
import { StudentProvider } from './session/StudentContext';
import { SoundProvider } from './features/sound';
import { ReadAloudProvider } from './features/read-aloud';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ReadAloudProvider>
      <SoundProvider>
        <StudentProvider>
          {import.meta.env.PROD && <UpdateBanner />}
          <RouterProvider router={router} />
        </StudentProvider>
      </SoundProvider>
    </ReadAloudProvider>
  );
}
