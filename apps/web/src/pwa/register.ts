interface ServiceWorkerHost {
  serviceWorker?: { register: (url: string, options: { scope: string }) => Promise<unknown> };
}

/**
 * Registers the offline service worker in production builds. In development the MSW mock API
 * worker uses the same scope, so ours stays off. Returns whether registration succeeded.
 */
export async function registerServiceWorker(
  host: ServiceWorkerHost,
  isProduction: boolean,
): Promise<boolean> {
  if (!isProduction || !host.serviceWorker) return false;
  try {
    await host.serviceWorker.register('/sw.js', { scope: '/' });
    return true;
  } catch {
    return false;
  }
}
