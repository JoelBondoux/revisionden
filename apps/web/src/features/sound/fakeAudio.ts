import type { AudioContextLike } from './engine';

/** A recorded oscillator: its wave type, every frequency it was set to, and when it ran. */
export interface FakeOscillator {
  type: string;
  frequencies: number[];
  start: number | null;
  stop: number | null;
}

/** A recorded noise burst: its filter type, every filter frequency, and when it ran. */
export interface FakeNoise {
  filter: string;
  frequencies: number[];
  start: number | null;
  stop: number | null;
}

/** A stand-in for the browser's AudioContext that records what a sound would do. */
export interface FakeAudioContext extends AudioContextLike {
  oscillators: FakeOscillator[];
  noises: FakeNoise[];
  /** Every filter made, with its type and the last frequency it was set to. */
  filters: { type: string; frequency: number }[];
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
    sampleRate: 8000,
    oscillators: [],
    noises: [],
    filters: [],
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
      const rec = { type: 'lowpass', frequency: 350, frequencies: [] as number[] };
      ctx.filters.push(rec);
      const frequency = param((v) => {
        rec.frequency = v;
        rec.frequencies.push(v);
      }, 350);
      return {
        ...node(),
        get type() {
          return rec.type;
        },
        set type(t: string) {
          rec.type = t;
        },
        frequency: Object.defineProperty(frequency, 'value', {
          get: () => rec.frequency,
          set: (v: number) => {
            rec.frequency = v;
            rec.frequencies.push(v);
          },
        }),
        Q: param(() => undefined),
      };
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      let filter: { type: string; frequencies: number[] } | null = null;
      const rec: FakeNoise = { filter: '', frequencies: [], start: null, stop: null };
      ctx.noises.push(rec);
      return {
        buffer: null,
        connect<T>(target: T): T {
          // A noise always feeds its filter first: record which one.
          if (!filter) {
            filter = ctx.filters[ctx.filters.length - 1] as unknown as typeof filter;
            rec.filter = filter!.type;
            rec.frequencies = filter!.frequencies;
          }
          return target;
        },
        start(at = 0) {
          rec.start = at;
        },
        stop(at = 0) {
          rec.stop = at;
        },
      };
    },
  };
  return ctx;
}
