import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';
import { UpdateBanner } from './pwa/updates';
import { StudentProvider } from './session/StudentContext';
import { SoundProvider } from './features/sound';
import { ReadingProvider } from './features/reading';
import { AppearanceProvider } from './features/appearance';
import { ReadAloudProvider } from './features/read-aloud';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AppearanceProvider>
      <ReadingProvider>
        <ReadAloudProvider>
          <SoundProvider>
            <StudentProvider>
              {/* The effect style lives inside the router (EffectStyleRoute, J10e). */}
              {import.meta.env.PROD && <UpdateBanner />}
              <RouterProvider router={router} />
            </StudentProvider>
          </SoundProvider>
        </ReadAloudProvider>
      </ReadingProvider>
    </AppearanceProvider>
  );
}
