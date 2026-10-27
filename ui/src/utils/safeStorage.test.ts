import { describe, expect, it } from 'vitest';
import { readStorage, writeStorage } from './safeStorage';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
};
const blocked = {
  getItem: () => { throw new DOMException('denied', 'SecurityError'); },
  setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
};

describe('safe storage', () => {
  it('reads back what it writes when storage works', () => {
    const storage = memory();
    expect(writeStorage('k', 'v', storage)).toBe(true);
    expect(readStorage('k', storage)).toBe('v');
    expect(readStorage('missing', storage)).toBeNull();
  });

  it('reports failure instead of throwing when storage is blocked or full', () => {
    expect(() => readStorage('k', blocked)).not.toThrow();
    expect(readStorage('k', blocked)).toBeNull();
    expect(writeStorage('k', 'v', blocked)).toBe(false);
  });

  it('treats missing storage as unavailable', () => {
    expect(readStorage('k', null)).toBeNull();
    expect(writeStorage('k', 'v', null)).toBe(false);
  });
});
