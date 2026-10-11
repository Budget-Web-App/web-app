import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, validateName } from './categoryName';

describe('validateName', () => {
  it('accepts a fresh name', () => {
    expect(validateName('Groceries', ['Rent'], 'category')).toBeNull();
  });

  it('rejects empty and whitespace-only names', () => {
    expect(validateName('', [], 'category')).toMatch(/category name/);
    expect(validateName('   ', [], 'group')).toMatch(/group name/);
  });

  it('rejects names over the server limit, after trimming', () => {
    expect(validateName('a'.repeat(MAX_NAME_LENGTH), [], 'category')).toBeNull();
    expect(validateName(` ${'a'.repeat(MAX_NAME_LENGTH)} `, [], 'category')).toBeNull();
    expect(validateName('a'.repeat(MAX_NAME_LENGTH + 1), [], 'category')).toMatch(/60/);
  });

  it('rejects duplicates ignoring case and whitespace', () => {
    expect(validateName(' groceries ', ['Groceries'], 'category')).toMatch(/already has/);
    expect(validateName('SAVINGS', ['Savings'], 'group')).toMatch(/already exists/);
  });
});
