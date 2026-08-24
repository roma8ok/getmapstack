import { describe, expect, test } from 'vitest';
import { DEFAULT_BASE, getBase, normalizeBase, setBase } from './target';

const fakeStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

describe('normalizeBase', () => {
  test('strips trailing slash and whitespace', () => {
    expect(normalizeBase(' http://localhost:4326/ ')).toBe('http://localhost:4326');
  });
  test('adds http:// when the scheme is missing', () => {
    expect(normalizeBase('localhost:4326')).toBe('http://localhost:4326');
  });
  test('keeps https', () => {
    expect(normalizeBase('https://box.example:4326')).toBe('https://box.example:4326');
  });
  test('handles upper-case schemes', () => {
    expect(normalizeBase('HTTP://host:4326')).toBe('HTTP://host:4326');
  });
});

describe('persistence', () => {
  test('getBase falls back to the default', () => {
    expect(getBase(fakeStorage())).toBe(DEFAULT_BASE);
  });
  test('setBase stores the normalized value and getBase returns it', () => {
    const s = fakeStorage();
    expect(setBase('myhost:4326/', s)).toBe('http://myhost:4326');
    expect(getBase(s)).toBe('http://myhost:4326');
  });
});
