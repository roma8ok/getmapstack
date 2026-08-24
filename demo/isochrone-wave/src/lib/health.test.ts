import { afterEach, describe, expect, test, vi } from 'vitest';
import { probeHealth } from './health';

afterEach(() => vi.useRealTimers());

describe('probeHealth', () => {
  test('ok on HTTP 200', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true });
    expect(await probeHealth('http://x', 5000, f as never)).toEqual({ ok: true });
    expect(f.mock.calls[0][0]).toBe('http://x/healthz');
  });

  test('http on a non-2xx answer', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await probeHealth('http://x', 5000, f as never)).toEqual({ ok: false, reason: 'http' });
  });

  // The image's gateway binds its port before its engines answer and returns
  // 503 until all three pass - minutes, on a large country. That is the right
  // container, still waking up, and it must not be called the wrong software.
  test('starting on HTTP 503', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    expect(await probeHealth('http://x', 5000, f as never)).toEqual({ ok: false, reason: 'starting' });
  });

  test('network on rejection', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await probeHealth('http://x', 5000, f as never)).toEqual({ ok: false, reason: 'network' });
  });

  test('timeout when nothing answers within the deadline', async () => {
    vi.useFakeTimers();
    const f = vi.fn((_: string, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))),
    );
    const p = probeHealth('http://x', 5000, f as never);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await p).toEqual({ ok: false, reason: 'timeout' });
  });
});
