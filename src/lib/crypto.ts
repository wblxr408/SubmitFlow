/**
 * 加密服务
 * AES-256-GCM 加密/解密
 * 所有涉及敏感数据的 CRUD 操作必须使用此服务
 */
import { createLogger } from './logger';
import crypto from 'crypto';

const log = createLogger('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * 加密明文
 * @returns base64(iv + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * 解密密文
 */
export function decrypt(encryptedData: string): string {
  const key = getKey();
  const buffer = Buffer.from(encryptedData, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * 验证密钥格式是否有效
 */
export function validateKey(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * 解密时吞掉错误并返回 null，防止崩溃
 */
export function safeDecrypt(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;
  try {
    return decrypt(encryptedData);
  } catch (err) {
    log.error({ err }, 'Decryption failed');
    return null;
  }
}
