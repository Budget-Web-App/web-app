/** localStorage that never throws: private mode, blocked storage and quota errors all degrade to "not saved". */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Not persisted; the in-memory state still works for this session. */
  }
}

export function readStoredList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(readStored(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
