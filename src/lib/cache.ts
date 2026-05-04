/**
 * 简单内存缓存
 * 轻量级缓存方案，替代 Redis 接口预留
 * 适用于开发环境和小型部署
 */
import { createLogger } from './logger';

const log = createLogger('cache');

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.data as T;
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 按模式删除缓存
   */
  invalidate(pattern: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        count++;
      }
    }
    log.debug({ pattern, count }, 'Cache invalidated');
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
    log.debug('Cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.store.size,
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }

    if (count > 0) {
      log.debug({ count }, 'Expired cache entries cleaned');
    }

    return count;
  }
}

// 单例导出
export const cache = new SimpleCache();

// 定期清理过期缓存（每 5 分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

// ============================================================
// 常用缓存键生成函数
// ============================================================
export const CacheKeys = {
  companies: (filters?: string) => filters ? `companies:${filters}` : 'companies:all',
  jobs: (filters?: string) => filters ? `jobs:${filters}` : 'jobs:all',
  recommendations: (userId: number) => `recommendations:${userId}`,
  userProfile: (userId: number) => `profile:${userId}`,
  tags: () => 'tags:all',
  graphNodes: () => 'graph:nodes',
  jobSources: () => 'sources:all',
};

// ============================================================
// 缓存辅助函数
// ============================================================
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fn();
  cache.set(key, data, ttlSeconds);
  return data;
}
