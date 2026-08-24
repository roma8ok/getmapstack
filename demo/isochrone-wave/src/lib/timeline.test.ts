import { describe, expect, test } from 'vitest';
import {
  DURATION, RATE, initial, loaded, pause, play, scrub, startLoading, tick,
} from './timeline';

describe('timeline', () => {
  test('load flow with autoplay', () => {
    const s = loaded(startLoading(initial), true);
    expect(s).toEqual({ phase: 'playing', t: 0 });
  });
  test('load flow with reduced motion pauses at zero', () => {
    expect(loaded(startLoading(initial), false)).toEqual({ phase: 'paused', t: 0 });
  });
  test('tick advances sim time at RATE and only while playing', () => {
    const s = tick({ phase: 'playing', t: 0 }, 0.1);
    expect(s.t).toBeCloseTo(0.1 * RATE);
    expect(tick({ phase: 'paused', t: 5 }, 1)).toEqual({ phase: 'paused', t: 5 });
  });
  test('tick clamps at DURATION and finishes', () => {
    const s = tick({ phase: 'playing', t: DURATION - 1 }, 10);
    expect(s).toEqual({ phase: 'finished', t: DURATION });
  });
  test('pause and resume', () => {
    expect(pause({ phase: 'playing', t: 42 })).toEqual({ phase: 'paused', t: 42 });
    expect(play({ phase: 'paused', t: 42 })).toEqual({ phase: 'playing', t: 42 });
  });
  test('play from finished restarts at zero', () => {
    expect(play({ phase: 'finished', t: DURATION })).toEqual({ phase: 'playing', t: 0 });
  });
  test('scrub pauses at the target and clamps', () => {
    expect(scrub({ phase: 'playing', t: 10 }, 300)).toEqual({ phase: 'paused', t: 300 });
    expect(scrub({ phase: 'finished', t: DURATION }, 2000)).toEqual({ phase: 'paused', t: DURATION });
  });
  test('scrub is ignored before data exists', () => {
    expect(scrub(initial, 300)).toEqual(initial);
    expect(scrub({ phase: 'loading', t: 0 }, 300)).toEqual({ phase: 'loading', t: 0 });
  });
});
