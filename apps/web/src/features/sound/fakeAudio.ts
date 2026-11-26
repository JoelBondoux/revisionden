import type { AudioContextLike } from './engine';

/** A recorded oscillator: its wave type, every frequency it was set to, and when it ran. */
export interface FakeOscillator {
  type: string;
  frequencies: number[];
  start: number | null;
  stop: number | null;
}

/** A stand-in for the browser's AudioContext that records what a sound would do. */
export interface FakeAudioContext extends AudioContextLike {
  oscillators: FakeOscillator[];
  gains: { value: number; peaks: number[] }[];
  resumeCalls: number;
  suspendCalls: number;
  /** Seconds from each envelope's start to its peak (how slowly each note swells in). */
  attacks: number[];
}

function param(record: (value: number) => void, initial = 0, onRamp?: (seconds: number) => void) {
  let lastSet = 0;
  return {
    value: initial,
    setValueAtTime(v: number, t = 0) {
      record(v);
      lastSet = t;
      return this;
    },
    linearRampToValueAtTime(v: number, t = 0) {
      record(v);
      onRamp?.(t - lastSet);
      return this;
    },
    exponentialRampToValueAtTime(v: number) {
      record(v);
      return this;
    },
    setTargetAtTime(v: number) {
      record(v);
      return this;
    },
  };
}

/** Makes a fake AudioContext, starting in the given state (browsers start it suspended). */
export function createFakeAudioContext(
  state: 'running' | 'suspended' = 'suspended',
): FakeAudioContext {
  const node = () => ({ connect: <T>(target: T) => target });
  const ctx: FakeAudioContext = {
    state,
    currentTime: 0,
    destination: node(),
    oscillators: [],
    gains: [],
    resumeCalls: 0,
    suspendCalls: 0,
    attacks: [],
    resume() {
      ctx.resumeCalls += 1;
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      ctx.suspendCalls += 1;
      ctx.state = 'suspended';
      return Promise.resolve();
    },
    createOscillator() {
      const rec: FakeOscillator = { type: 'sine', frequencies: [], start: null, stop: null };
      ctx.oscillators.push(rec);
      return {
        ...node(),
        get type() {
          return rec.type;
        },
        set type(t: string) {
          rec.type = t;
        },
        frequency: param((v) => rec.frequencies.push(v)),
        start(at = 0) {
          rec.start = at;
        },
        stop(at = 0) {
          rec.stop = at;
        },
      };
    },
    createGain() {
      const rec = { value: 1, peaks: [] as number[] };
      ctx.gains.push(rec);
      const gain = param(
        (v) => rec.peaks.push(v),
        1,
        (s) => void ctx.attacks.push(s),
      );
      return {
        ...node(),
        gain: Object.defineProperty(gain, 'value', {
          get: () => rec.value,
          set: (v: number) => {
            rec.value = v;
          },
        }),
      };
    },
    createBiquadFilter() {
      return {
        ...node(),
        type: 'lowpass',
        frequency: param(() => undefined),
        Q: param(() => undefined),
      };
    },
  };
  return ctx;
}
