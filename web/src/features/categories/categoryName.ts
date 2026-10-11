/** Matches the server limit in `server/src/routes/categories.ts`. */
export const MAX_NAME_LENGTH = 60;

export type NameKind = 'category' | 'group';

/**
 * Returns a user-facing problem with `raw`, or null when it is valid.
 * `existing` holds the sibling names, so duplicates are caught before a
 * round trip. Comparison ignores case and surrounding whitespace.
 */
export function validateName(
  raw: string,
  existing: string[],
  kind: NameKind,
): string | null {
  const name = raw.trim();
  if (!name) return `Enter a ${kind} name.`;
  if (name.length > MAX_NAME_LENGTH) {
    return `Keep it under ${MAX_NAME_LENGTH} characters.`;
  }
  const key = name.toLowerCase();
  if (existing.some((other) => other.trim().toLowerCase() === key)) {
    return kind === 'category'
      ? 'This group already has a category with that name.'
      : 'A group with that name already exists.';
  }
  return null;
}
