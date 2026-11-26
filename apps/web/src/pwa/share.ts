/** The device's share sheet and clipboard; each left out when the browser lacks it. */
export interface ShareApis {
  share?: (data: { text: string }) => Promise<void>;
  copy?: (text: string) => Promise<void>;
}

/** The share sheet and clipboard of a browser's `navigator` (injected in tests). */
export function browserShareApis(nav: Navigator | undefined): ShareApis {
  return {
    ...(nav?.share ? { share: (data: { text: string }) => nav.share(data) } : {}),
    ...(nav?.clipboard ? { copy: (text: string) => nav.clipboard.writeText(text) } : {}),
  };
}

/** The share sheet was closed without sharing: not an error. */
export function isShareCancelled(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
