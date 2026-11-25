/** Test helper: makes `prefers-reduced-motion` match (or not). Undo with vi.unstubAllGlobals(). */
export function stubReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: reduced && media.includes('prefers-reduced-motion'),
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
