/**
 * 认证核心服务
 * 封装密码哈希、JWT 令牌、认证验证等核心功能
 */
import bcrypt from 'bcrypt'
import jwt, { JwtPayload as JsonWebTokenPayload, SignOptions } from 'jsonwebtoken'
import { query, execute, queryOne } from '@/lib/db'
import { encrypt, safeDecrypt } from '@/lib/crypto'
import { createLogger } from '@/lib/logger'
import { normalizeAuthJwtPayload } from '@/lib/auth-jwt-payload'
import crypto from 'crypto'

const log = createLogger('auth')

// JWT 配置（生产环境必须配置 JWT_SECRET）
const JWT_SECRET = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY?.slice(0, 32)

if (!JWT_SECRET) {
  throw new Error(
    '[AUTH] JWT_SECRET or ENCRYPTION_KEY environment variable is required. ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  )
}

if ((JWT_SECRET as string).length < 32) {
  throw new Error('[AUTH] JWT_SECRET must be at least 32 characters')
}

const jwtSecret: string = JWT_SECRET

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS = 12

// 邮箱验证 token 长度
const VERIFICATION_TOKEN_LENGTH = 32
const RESET_TOKEN_LENGTH = 32

// ============================================================
// 类型定义
// ============================================================
export interface User {
  id: number
  email: string
  password_hash: string
  nickname: string | null
  role: 'user' | 'admin'
  is_active: boolean
  email_verified: boolean
  verification_token: string | null
  reset_token: string | null
  reset_token_expires_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: User
  token?: string
}

// ============================================================
// 密码服务
// ============================================================
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================================
// Token 生成
// ============================================================
function generateToken(length: number): string {
  return crypto.randomBytes(length).toString('hex')
}

export function generateVerificationToken(): string {
  return generateToken(VERIFICATION_TOKEN_LENGTH)
}

export function generateResetToken(): string {
  return generateToken(RESET_TOKEN_LENGTH)
}

// ============================================================
// JWT 服务
// ============================================================
export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: '7d' }
  const normalizedPayload = normalizeAuthJwtPayload(payload)

  if (!normalizedPayload) {
    throw new Error('[AUTH] Invalid JWT payload')
  }

  return jwt.sign(normalizedPayload as object, jwtSecret, options)
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret) as JsonWebTokenPayload
    return normalizeAuthJwtPayload(payload)
  } catch {
    return null
  }
}

// ============================================================
// 用户服务
// ============================================================
export async function createUser(
  email: string,
  password: string,
  nickname?: string
): Promise<AuthResult> {
  // 验证邮箱格式
  if (!isValidEmail(email)) {
    return { success: false, error: '邮箱格式不正确' }
  }

  // 验证密码强度
  if (!isValidPassword(password)) {
    return { success: false, error: '密码至少 8 位，需包含字母和数字' }
  }

  // 检查邮箱是否已存在
  const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1', [
    email.toLowerCase(),
  ])

  if (existing) {
    return { success: false, error: '该邮箱已注册' }
  }

  // 哈希密码
  const passwordHash = await hashPassword(password)

  // 生成验证 token
  const verificationToken = generateVerificationToken()

  try {
    // 创建用户
    const result = await queryOne<User>(
      `INSERT INTO users (email, password_hash, nickname, verification_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [email.toLowerCase(), passwordHash, nickname || null, verificationToken]
    )

    if (!result) {
      return { success: false, error: '创建用户失败' }
    }

    // 创建关联的 profile
    await execute(
      `INSERT INTO profiles (user_id, mode, created_at, updated_at)
       VALUES ($1, 'default', NOW(), NOW())`,
      [result.id]
    )

    log.info({ userId: result.id, email }, 'User created')

    return {
      success: true,
      user: result,
      token: signToken({
        userId: result.id,
        email: result.email,
        role: result.role,
      }),
    }
  } catch (err: unknown) {
    const pg = err as { code?: string; message?: string; detail?: string }
    log.error({ err, email }, 'Failed to create user')
    // 23505: 常见原因包括邮箱唯一冲突，或 users/profiles 序列未对齐导致主键重复（见 migrations/011）
    if (pg.code === '23505') {
      if (pg.detail?.includes('email') || pg.message?.includes('users_email')) {
        return { success: false, error: '该邮箱已注册' }
      }
      return {
        success: false,
        error: '注册失败（数据库主键冲突）。请在项目根目录执行 pnpm run db:migrate 后重试。',
      }
    }
    return { success: false, error: '创建用户失败，请稍后重试' }
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  // 查找用户
  const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])

  if (!user) {
    return { success: false, error: '邮箱或密码错误' }
  }

  // 检查账户是否激活
  if (!user.is_active) {
    return { success: false, error: '账户已被禁用' }
  }

  // 验证密码
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    return { success: false, error: '邮箱或密码错误' }
  }

  log.info({ userId: user.id }, 'User logged in')

  return {
    success: true,
    user,
    token: signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }),
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [userId])
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
}

export async function verifyUserEmail(token: string): Promise<AuthResult> {
  const user = await queryOne<User>('SELECT * FROM users WHERE verification_token = $1', [token])

  if (!user) {
    return { success: false, error: '验证链接无效或已过期' }
  }

  if (user.email_verified) {
    return { success: true, user }
  }

  await execute(
    `UPDATE users SET email_verified = TRUE, verification_token = NULL, updated_at = NOW()
     WHERE id = $1`,
    [user.id]
  )

  const updatedUser = await getUserById(user.id)
  return { success: true, user: updatedUser || undefined }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const user = await getUserByEmail(email)

  if (!user) {
    // 为防止邮箱枚举攻击，仍返回成功
    return { success: true }
  }

  const resetToken = generateResetToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 小时后过期

  await execute(
    `UPDATE users SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW()
     WHERE id = $3`,
    [resetToken, expiresAt, user.id]
  )

  log.info({ userId: user.id }, 'Password reset requested')

  return { success: true }
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  // 验证密码强度
  if (!isValidPassword(newPassword)) {
    return { success: false, error: '密码至少 8 位，需包含字母和数字' }
  }

  const user = await queryOne<User>(
    `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires_at > NOW()`,
    [token]
  )

  if (!user) {
    return { success: false, error: '重置链接无效或已过期' }
  }

  const passwordHash = await hashPassword(newPassword)

  await execute(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, user.id]
  )

  log.info({ userId: user.id }, 'Password reset completed')

  return { success: true, user }
}

export async function updateUserProfile(
  userId: number,
  data: { nickname?: string; email?: string }
): Promise<AuthResult> {
  const updates: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (data.nickname !== undefined) {
    updates.push(`nickname = $${idx++}`)
    params.push(data.nickname)
  }

  if (data.email !== undefined) {
    if (!isValidEmail(data.email)) {
      return { success: false, error: '邮箱格式不正确' }
    }
    updates.push(`email = $${idx++}`)
    params.push(data.email.toLowerCase())
  }

  if (updates.length === 0) {
    return { success: false, error: '没有需要更新的字段' }
  }

  updates.push(`updated_at = NOW()`)
  params.push(userId)

  await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params)

  const user = await getUserById(userId)
  return { success: true, user: user || undefined }
}

// ============================================================
// 验证工具
// ============================================================
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPassword(password: string): boolean {
  // 至少 8 位，包含字母和数字
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
  return passwordRegex.test(password)
}

// ============================================================
// Cookie 配置
// ============================================================
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && process.env.DOCKER_ENV !== '1',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 天
  path: '/',
}
