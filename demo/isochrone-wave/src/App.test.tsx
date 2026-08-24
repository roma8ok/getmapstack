import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

let clickHandler: ((p: { lat: number; lon: number }) => void) | null = null;
vi.mock('./ui/MapView', () => ({
  __esModule: true,
  default: (props: { onPick: (p: { lat: number; lon: number }) => void }) => {
    clickHandler = props.onPick;
    return <div data-testid="map" />;
  },
}));

const recording = (city: string) => ({
  city,
  label: 'Netherlands',
  country: 'netherlands',
  image: 'getmapstack/netherlands',
  snapshot: '2026-08-14',
  origin: { lat: 52.3728, lon: 4.8936 },
  modes: {
    car: Array.from({ length: 15 }, (_, i) => square((i + 1) * 0.03)),
    bike: Array.from({ length: 15 }, (_, i) => square((i + 1) * 0.01)),
    walk: Array.from({ length: 15 }, (_, i) => square((i + 1) * 0.004)),
  },
});
const square = (s: number) => ({
  type: 'Polygon',
  coordinates: [[[0, 0], [s, 0], [s, s], [0, s], [0, 0]]],
});

import App from './App';

beforeEach(() => {
  localStorage.clear();
  clickHandler = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('App - recorded mode', () => {
  test('opens on the map with a city playing, no connect screen', async () => {
    render(<App />);
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.queryByText(/docker run/)).toBeNull();
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    expect(screen.getByText(/recorded 2026-08-14/i)).toBeTruthy();
  });

  test('a click on the map opens the run panel with that country', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    clickHandler!({ lat: 52.1, lon: 4.9 });
    await waitFor(() => expect(screen.getByText(/docker run/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /netherlands/i })).toBeTruthy();
  });

  test('the corner button opens the same panel', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    await waitFor(() => expect(screen.getByText(/docker run/)).toBeTruthy());
  });

  // Same panel, two doors: only one of them has a point to talk about.
  test('each door tells the panel whether a point was picked', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    clickHandler!({ lat: 52.1, lon: 4.9 });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('heading', { name: /this point/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('heading', { name: /your own map/i })).toBeTruthy();
  });

  test('another city loads the next fixture', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    const calls = () => (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls.length;
    const before = calls();
    fireEvent.click(screen.getByRole('button', { name: /another city/i }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
  });

  test('a broken fixture is survivable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /another city/i })).toBeTruthy();
  });
});

describe('App - going live', () => {
  const liveFetch = (opts: { bounds: number[] }) =>
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      if (url.endsWith('/healthz')) return { ok: true, json: async () => ({ status: 'ok' }) };
      if (url.endsWith('/martin/basemap')) return { ok: true, json: async () => ({ bounds: opts.bounds }) };
      if (url.endsWith('/valhalla/isochrone') && init?.method === 'POST')
        return { ok: true, json: async () => ({
          features: [1, 2, 3, 4].map((m) => ({ properties: { contour: m }, geometry: square(m * 0.02) })),
        }) };
      throw new Error(`unexpected ${url}`);
    });

  test('a successful probe drops the recorded chrome', async () => {
    vi.stubGlobal('fetch', liveFetch({ bounds: [3, 50, 8, 54] }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/localhost:4326/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /another city/i })).toBeNull();
    expect(screen.queryByText(/recorded 2026-08-14/)).toBeNull();
    expect(screen.queryByText(/docker run/)).toBeNull();
  });

  test('a click after connecting computes a live wave', async () => {
    const f = liveFetch({ bounds: [3, 50, 8, 54] });
    vi.stubGlobal('fetch', f);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/localhost:4326/)).toBeTruthy());
    clickHandler!({ lat: 52.1, lon: 4.9 });          // inside the connected bounds
    await waitFor(() =>
      expect(f.mock.calls.some(([u]) => String(u).endsWith('/valhalla/isochrone'))).toBe(true),
    );
  });

  test('the click made before connecting is honored', async () => {
    const f = liveFetch({ bounds: [3, 50, 8, 54] });
    vi.stubGlobal('fetch', f);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    clickHandler!({ lat: 52.1, lon: 4.9 });
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() =>
      expect(f.mock.calls.some(([u]) => String(u).endsWith('/valhalla/isochrone'))).toBe(true),
    );
  });

  test('a click outside the country is not computed', async () => {
    const f = liveFetch({ bounds: [3, 50, 8, 54] });
    vi.stubGlobal('fetch', f);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    clickHandler!({ lat: 35.1, lon: 33.3 });          // Cyprus, far outside the bounds
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/localhost:4326/)).toBeTruthy());
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/valhalla/isochrone'))).toBe(false);
  });

  test('live with nothing computed names the country and says what to do next', async () => {
    vi.stubGlobal('fetch', liveFetch({ bounds: [3, 50, 8, 54] }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/localhost:4326/)).toBeTruthy());
    // The country badge under the logo: the one fact that changed. This
    // container does not answer /countries.json, so the picked country stands.
    expect(screen.getByText('Netherlands')).toBeTruthy();
    // No transport for a recording that no longer exists.
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText(/click anywhere/i)).toBeTruthy();
  });

  // A visitor can point the page at a container other than the one the panel
  // was showing - the badge has to name the map on the screen.
  test('the badge names the country the container serves, not the one picked', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      if (url.endsWith('/healthz')) return { ok: true, json: async () => ({}) };
      if (url.endsWith('/countries.json')) return { ok: true, json: async () => ({ countries: ['cyprus'] }) };
      if (url.endsWith('/martin/basemap')) return { ok: true, json: async () => ({ bounds: [32, 34, 35, 36] }) };
      if (url.endsWith('/valhalla/isochrone') && init?.method === 'POST')
        return { ok: true, json: async () => ({ features: [] }) };
      throw new Error(`unexpected ${url}`);
    }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Amsterdam')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText('Cyprus')).toBeTruthy());
    expect(screen.queryByText('Netherlands')).toBeNull();
  });

  // The gateway binds its port before its engines answer. Calling that "not a
  // getmapstack container" tells a visitor whose container is fine that they
  // ran the wrong thing.
  test('a container still starting is told to wait, not that it is the wrong software', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      if (url.endsWith('/healthz')) return { ok: false, status: 503 };
      throw new Error(`unexpected ${url}`);
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/engines are still starting/i)).toBeTruthy());
    expect(screen.queryByText(/not like a getmapstack container/i)).toBeNull();
    expect(screen.getByRole('button', { name: /i started it/i }).hasAttribute('disabled')).toBe(false);
  });

  // A healthy-looking answer that is not ours fails inside r.json(); the parser
  // message is not something to show a visitor.
  test('a server that is not getmapstack fails in words, not in parser output', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      if (url.endsWith('/healthz')) return { ok: true, json: async () => ({}) };
      if (url.endsWith('/martin/basemap'))
        return { ok: true, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } };
      throw new Error(`unexpected ${url}`);
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/not like a getmapstack container/i)).toBeTruthy());
    expect(screen.queryByText(/unexpected token/i)).toBeNull();
  });

  test('closing the panel abandons a probe still in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const f = vi.fn(async (url: string) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      if (url.endsWith('/healthz')) { await gate; return { ok: true, json: async () => ({}) }; }
      if (url.endsWith('/martin/basemap')) return { ok: true, json: async () => ({ bounds: [3, 50, 8, 54] }) };
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', f);
    render(<App />);
    const cta = screen.getByRole('button', { name: /run it yourself/i });
    cta.focus();          // a real click focuses the button; fireEvent does not
    fireEvent.click(cta);
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText(/docker run/)).toBeNull();
    // The panel also hands focus back to the control that opened it.
    expect(document.activeElement).toBe(cta);
    release();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/martin/basemap'))).toBe(false);
    expect(screen.queryByText(/localhost:4326/)).toBeNull();
  });

  test('a failed probe keeps the panel open with the reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/recorded/')) return { ok: true, json: async () => recording('Amsterdam') };
      throw new TypeError('Failed to fetch');
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /run it yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    await waitFor(() => expect(screen.getByText(/could not reach the container/i)).toBeTruthy());
  });
});
