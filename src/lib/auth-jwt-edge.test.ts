import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('verifyAuthToken', () => {
  const jwtSecret = '1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = jwtSecret;
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('accepts existing tokens whose userId was serialized as a string', async () => {
    const token = jwt.sign(
      {
        userId: '4',
        email: 'user@example.com',
        role: 'user',
      },
      jwtSecret,
      { expiresIn: '7d' },
    );

    const { verifyAuthToken } = await import('./auth-jwt-edge');

    await expect(verifyAuthToken(token)).resolves.toEqual({
      userId: 4,
      email: 'user@example.com',
      role: 'user',
    });
  });

  it('rejects tokens whose userId is not numeric', async () => {
    const token = jwt.sign(
      {
        userId: 'not-a-number',
        email: 'user@example.com',
        role: 'user',
      },
      jwtSecret,
      { expiresIn: '7d' },
    );

    const { verifyAuthToken } = await import('./auth-jwt-edge');

    await expect(verifyAuthToken(token)).resolves.toBeNull();
  });
});
