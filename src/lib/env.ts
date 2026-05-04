/**
 * 环境变量校验
 * 在应用启动时统一校验所有必需的环境变量
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('env');

export function validateEnv(): void {
  const required: Array<{ key: string; check: () => boolean }> = [
    {
      key: 'DATABASE_URL',
      check: () => !!process.env.DATABASE_URL,
    },
    {
      key: 'ENCRYPTION_KEY',
      check: () => {
        const key = process.env.ENCRYPTION_KEY;
        return !!key && key.length === 64 && /^[a-f0-9]+$/.test(key);
      },
    },
  ];

  const optional: Array<{ key: string; check: () => boolean; default: string }> = [
    {
      key: 'JWT_SECRET',
      check: () => !!process.env.JWT_SECRET && process.env.JWT_SECRET!.length >= 32,
      default: '(使用 ENCRYPTION_KEY 前32位)',
    },
    {
      key: 'JWT_EXPIRES_IN',
      check: () => true,
      default: '7d',
    },
    {
      key: 'SMTP_HOST',
      check: () => true,
      default: '(未配置，邮件功能不可用)',
    },
    {
      key: 'SMTP_PORT',
      check: () => true,
      default: '587',
    },
    {
      key: 'SMTP_USER',
      check: () => true,
      default: '(未配置)',
    },
    {
      key: 'SMTP_PASS',
      check: () => true,
      default: '(未配置)',
    },
  ];

  const missing = required.filter((r) => !r.check());

  if (missing.length > 0) {
    const msgs = missing.map((m) => `  - ${m.key}`).join('\n');
    throw new Error(`Missing required environment variables:\n${msgs}`);
  }

  const unconfigured = optional.filter((o) => !o.check());
  if (unconfigured.length > 0) {
    log.warn({ keys: unconfigured.map((u) => u.key) }, 'Optional variables using defaults');
  }
}
