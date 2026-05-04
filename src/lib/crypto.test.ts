import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt, decrypt, safeDecrypt } from '../lib/crypto';

describe('CryptoService', () => {
  // 这些测试需要真实的 ENCRYPTION_KEY
  const realKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    if (!realKey || realKey.length !== 64) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }
  });

  afterAll(() => {
    if (realKey) {
      process.env.ENCRYPTION_KEY = realKey;
    }
  });

  it('encrypts and decrypts correctly', () => {
    const plaintext = 'hello world 你好';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext', () => {
    const plaintext = 'test';
    const e1 = encrypt(plaintext);
    const e2 = encrypt(plaintext);
    expect(e1).not.toBe(e2); // random IV ensures uniqueness
  });

  it('safeDecrypt returns null for invalid input', () => {
    expect(safeDecrypt(null)).toBeNull();
    expect(safeDecrypt(undefined)).toBeNull();
  });

  it('safeDecrypt returns null for tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(safeDecrypt(tampered)).toBeNull();
  });
});
