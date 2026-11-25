import { createInstallStore } from './install';

/**
 * The app's one install store. Imported by `main.tsx` before React renders, because the browser
 * fires `beforeinstallprompt` once, early.
 */
export const appInstallStore = createInstallStore(
  typeof window === 'undefined' ? new EventTarget() : window,
);
