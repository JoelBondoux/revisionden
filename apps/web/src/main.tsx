import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/base.css';
import './components/components.css';
import './layout/layout.css';
import { App } from './App';
import { registerServiceWorker } from './pwa/register';

/** Until the real API (workstream B) is live, development uses the MSW mock API. */
async function startMocks() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

void startMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

void registerServiceWorker(navigator, import.meta.env.PROD);
