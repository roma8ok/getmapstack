const KEY = 'isochrone-wave.base';

export const DEFAULT_BASE = 'http://localhost:4326';

export function normalizeBase(u: string): string {
  let s = u.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  return s;
}

export function getBase(storage: Storage = localStorage): string {
  return storage.getItem(KEY) ?? DEFAULT_BASE;
}

export function setBase(u: string, storage: Storage = localStorage): string {
  const v = normalizeBase(u);
  storage.setItem(KEY, v);
  return v;
}
