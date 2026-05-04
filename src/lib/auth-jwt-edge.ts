/**
 * Edge / Middleware 可用的 JWT 校验（仅用 jose，禁止依赖 bcrypt / pg / Node crypto 等）
 * 须与 src/lib/auth.ts 中 signToken 的算法与密钥逻辑保持一致
 */
import { jwtVerify } from 'jose';
import { normalizeAuthJwtPayload, type AuthJwtPayload } from '@/lib/auth-jwt-payload';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.ENCRYPTION_KEY?.slice(0, 32);

const encoder = new TextEncoder();

function getSecretKey() {
  if (!JWT_SECRET) {
    throw new Error(
      '[AUTH] JWT_SECRET or ENCRYPTION_KEY environment variable is required'
    );
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('[AUTH] JWT_SECRET must be at least 32 characters');
  }
  return encoder.encode(JWT_SECRET);
}

/**
 * 校验会话 JWT（HS256，与 jsonwebtoken 默认一致）
 */
export async function verifyAuthToken(token: string): Promise<AuthJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });

    return normalizeAuthJwtPayload(payload);
  } catch {
    return null;
  }
}
