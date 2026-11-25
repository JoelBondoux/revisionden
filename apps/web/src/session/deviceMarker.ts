/**
 * The device marker (I5b): a random code the API gives this browser when it links or first
 * unlocks, so a passkey synced to another device is seen as a new device. Kept in local storage
 * on this device only (docs/legal/cookies-and-storage.md); the server stores only its hash.
 */
const KEY = 'revisionden.deviceMarker';

export function readDeviceMarker(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveDeviceMarker(marker: string | undefined): void {
  if (!marker) return;
  try {
    window.localStorage.setItem(KEY, marker);
  } catch {
    // Storage blocked (private mode): the next unlock may count as a new device, at most once a day.
  }
}
