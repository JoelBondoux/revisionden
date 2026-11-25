import { act, renderHook } from '@testing-library/react';
import { useReducedMotion } from './motion';
import { stubReducedMotion } from './testing';

afterEach(() => vi.unstubAllGlobals());

describe('reduced motion switch', () => {
  it('follows the device setting', () => {
    stubReducedMotion(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    stubReducedMotion(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('assumes motion is fine where the browser cannot say', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('updates when the setting changes while the screen is open', () => {
    let listener: () => void = () => undefined;
    const list = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => {
        listener = fn;
      },
      removeEventListener: () => undefined,
    };
    vi.stubGlobal('matchMedia', () => list);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    list.matches = true;
    act(() => listener());
    expect(result.current).toBe(true);
  });
});
