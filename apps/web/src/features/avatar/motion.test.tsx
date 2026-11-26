import { act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REACTION_MS, useAvatarMotion } from './motion';

describe('useAvatarMotion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('idles, plays a reaction, then goes back to idle', () => {
    const { result } = renderHook(() => useAvatarMotion({ reducedMotion: () => false }));
    expect(result.current.props.motion).toBe('idle');
    act(() => result.current.react('nod'));
    expect(result.current.props.motion).toBe('nod');
    act(() => {
      vi.advanceTimersByTime(REACTION_MS.nod);
    });
    expect(result.current.props.motion).toBe('idle');
  });

  it('gives each reaction a new key, so the same one plays again', () => {
    const { result } = renderHook(() => useAvatarMotion({ reducedMotion: () => false }));
    act(() => result.current.react('hop'));
    const first = result.current.props.motionKey;
    act(() => result.current.react('hop'));
    expect(result.current.props.motionKey).not.toBe(first);
    // The earlier timer must not cut the second hop short.
    act(() => {
      vi.advanceTimersByTime(REACTION_MS.hop - 1);
    });
    expect(result.current.props.motion).toBe('hop');
  });

  it('stays still with reduced motion, even for reactions', () => {
    const { result } = renderHook(() => useAvatarMotion({ reducedMotion: () => true }));
    expect(result.current.props.motion).toBe('still');
    act(() => result.current.react('hmm'));
    expect(result.current.props.motion).toBe('still');
  });

  it('passes paused through, for questions and Test mode (reactions still play)', () => {
    const { result } = renderHook(() =>
      useAvatarMotion({ paused: true, reducedMotion: () => false }),
    );
    expect(result.current.props.paused).toBe(true);
    act(() => result.current.react('nod'));
    expect(result.current.props.motion).toBe('nod');
  });
});

const css = readFileSync(join(__dirname, 'avatar.css'), 'utf8');

describe('avatar motion styles', () => {
  it('moves parts with transforms only', () => {
    const frames = [...css.matchAll(/@keyframes avatar-[\w-]+ \{([\s\S]*?)\n\}/g)].map(
      (m) => m[1]!,
    );
    expect(frames.length).toBeGreaterThanOrEqual(6);
    for (const body of frames) {
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      for (const p of props) expect(p).toBe('transform');
    }
  });

  it('turns every avatar animation off with reduced motion', () => {
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('[data-motion-part]');
    expect(reduced).toContain('animation: none');
  });

  it('stops the idle loop when paused or hidden', () => {
    expect(css).toMatch(
      /\.avatar-svg\[data-hidden='true'\] \[data-motion-part\][^{]*\{\s*animation-play-state: paused/,
    );
    expect(css).toContain(".avatar-svg[data-motion='idle'][data-paused='true'] [data-motion-part]");
  });

  it('pivots the head on the neck and the figure on its feet', () => {
    expect(css).toMatch(/\[data-motion-part='head-back'\] \{[^}]*transform-origin: 60px 74px/);
    expect(css).toMatch(/\[data-motion-part='figure'\] \{[^}]*transform-origin: 60px 120px/);
    expect(css).toContain('transform-box: view-box');
  });

  it('moves the hair behind the body in step with the head, in every rule', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const lists = [...bare.matchAll(/([^{}]+)\{/g)].map((m) =>
      m[1]!.split(',').map((x) => x.trim()),
    );
    let checked = 0;
    for (const list of lists) {
      for (const sel of list.filter((x) => x.includes("[data-motion-part='head']"))) {
        expect(list, sel).toContain(sel.replace("'head'", "'head-back'"));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});
