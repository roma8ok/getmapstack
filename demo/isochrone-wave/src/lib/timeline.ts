export const DURATION = 900; // sim seconds = 15 minutes
export const RATE = 50; // sim seconds per real second (~18 s per run)

export type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';
export type TimelineState = { phase: Phase; t: number };

export const initial: TimelineState = { phase: 'idle', t: 0 };

export const startLoading = (_s: TimelineState): TimelineState => ({ phase: 'loading', t: 0 });

export const loaded = (s: TimelineState, autoplay: boolean): TimelineState =>
  s.phase === 'loading' ? { phase: autoplay ? 'playing' : 'paused', t: 0 } : s;

export const play = (s: TimelineState): TimelineState => {
  if (s.phase === 'finished') return { phase: 'playing', t: 0 };
  if (s.phase === 'paused') return { ...s, phase: 'playing' };
  return s;
};

export const pause = (s: TimelineState): TimelineState =>
  s.phase === 'playing' ? { ...s, phase: 'paused' } : s;

export const scrub = (s: TimelineState, t: number): TimelineState =>
  s.phase === 'idle' || s.phase === 'loading'
    ? s
    : { phase: 'paused', t: Math.min(DURATION, Math.max(0, t)) };

export const tick = (s: TimelineState, dtSeconds: number): TimelineState => {
  if (s.phase !== 'playing') return s;
  const t = Math.min(DURATION, s.t + dtSeconds * RATE);
  return { phase: t >= DURATION ? 'finished' : 'playing', t };
};
