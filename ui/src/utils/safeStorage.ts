/**
 * Browser storage can be missing or throw (private windows, blocked site data, full quota).
 * These helpers never throw, so the current session stays usable without persistence.
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readStorage(key: string, storage?: StorageLike | null): string | null {
  try {
    return resolveStorage(storage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be persisted. */
export function writeStorage(key: string, value: string, storage?: StorageLike | null): boolean {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
