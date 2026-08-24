export type ProbeResult =
  | { ok: true }
  | { ok: false; reason: 'timeout' | 'starting' | 'http' | 'network' };

export async function probeHealth(
  base: string,
  timeoutMs = 5000,
  fetchFn: typeof fetch = fetch,
): Promise<ProbeResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(`${base}/healthz`, { signal: ctl.signal });
    if (r.ok) return { ok: true };
    // The image's gateway binds its port immediately and answers 503 until all
    // three engines pass their own probes - a window measured in minutes on a
    // large country, whose geocoding index takes that long to open. That is the
    // right container starting up, not some other server on the port, and it is
    // the likeliest thing a visitor hits on the way to a live map.
    return { ok: false, reason: r.status === 503 ? 'starting' : 'http' };
  } catch {
    return { ok: false, reason: ctl.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
