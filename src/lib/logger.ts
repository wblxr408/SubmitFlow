/**
 * 日志服务
 * 使用 pino（高性能结构化日志），兼容 Winston 接口
 */
import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

// In Next.js dev mode, pino-pretty's worker thread conflicts with Next.js's
// own worker threads (especially during compilation). Use sync mode to avoid
// "worker thread exited" crashes in development.
const isNextDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level,
  transport: isNextDev
    ? undefined
    : process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  base: {
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createLogger = (module: string) =>
  logger.child({ module });
