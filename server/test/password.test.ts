import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password';

describe('password hashing', () => {
  it('verifies a matching password', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('wrong battery', hash)).toBe(false);
  });

  it('uses a fresh salt each time and never stores the plaintext', () => {
    const first = hashPassword('same password');
    const second = hashPassword('same password');
    expect(first).not.toBe(second);
    expect(first).not.toContain('same password');
  });
});