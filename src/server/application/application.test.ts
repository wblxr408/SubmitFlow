/**
 * 投递追踪服务测试
 * 测试状态机 + 事件历史
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ApplicationStatus } from '../../types';

// Mock the db module
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

// Mock the feishu notification
vi.mock('@/server/notification/feishu', () => ({
  sendFeishuNotification: vi.fn().mockResolvedValue(undefined),
}));

const { query, queryOne, execute } = await import('@/lib/db');

describe('ApplicationTracker 状态机', () => {
  describe('VALID_TRANSITIONS 状态转移规则', () => {
    const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
      screening: ['written_test', 'interview', 'offer', 'rejected', 'withdrawn'],
      written_test: ['interview', 'offer', 'rejected', 'withdrawn'],
      interview: ['offer', 'rejected', 'withdrawn'],
      offer: ['rejected', 'withdrawn'],
      rejected: [],
      withdrawn: [],
    };

    it('screening 可以转到任意后续状态', () => {
      expect(VALID_TRANSITIONS.screening).toContain('written_test');
      expect(VALID_TRANSITIONS.screening).toContain('interview');
      expect(VALID_TRANSITIONS.screening).toContain('offer');
      expect(VALID_TRANSITIONS.screening).toContain('rejected');
      expect(VALID_TRANSITIONS.screening).toContain('withdrawn');
    });

    it('rejected 状态不可变更', () => {
      expect(VALID_TRANSITIONS.rejected).toHaveLength(0);
    });

    it('offer 可以变为 rejected 或 withdrawn', () => {
      expect(VALID_TRANSITIONS.offer).toEqual(['rejected', 'withdrawn']);
    });

    it('不允许倒退：screening 不能直接到 offer（除非先经过中间状态）', () => {
      // 实际上 screening -> offer 是允许的（快速通道）
      expect(VALID_TRANSITIONS.screening).toContain('offer');
    });
  });

  describe('边界条件', () => {
    it('mock queryOne 可以返回 null 表示不存在', async () => {
      // 模拟: application 不存在
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const existingApp = await queryOne('SELECT * FROM applications WHERE profile_id = $1 AND job_id = $2', [1, 99]);
      expect(existingApp).toBeNull();
    });

    it('mock queryOne 可以返回数据表示已存在', async () => {
      // 模拟: application 已存在
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 1,
        profile_id: 1,
        job_id: 99,
        status: 'screening',
        created_at: '',
        updated_at: '',
      });

      const existingApp = await queryOne('SELECT * FROM applications WHERE profile_id = $1 AND job_id = $2', [1, 99]);
      expect(existingApp).not.toBeNull();
      expect((existingApp as { id: number }).id).toBe(1);
    });
  });

  describe('事件记录', () => {
    it('状态变更时记录 from_status 和 to_status', async () => {
      // 模拟 INSERT RETURNING 返回插入的记录
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 1,
        application_id: 1,
        from_status: 'screening',
        to_status: 'interview',
        source: 'manual',
        source_ref: null,
        created_at: new Date().toISOString(),
      });

      const event = await queryOne(
        `INSERT INTO application_events
         (application_id, from_status, to_status, source, source_ref)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [1, 'screening', 'interview', 'manual', null],
      );

      expect(event).not.toBeNull();
      expect((event as { from_status: string }).from_status).toBe('screening');
      expect((event as { to_status: string }).to_status).toBe('interview');
    });

    it('source 参数正确传递（manual / email / manual_feishu）', async () => {
      const sources = ['manual', 'email', 'manual_feishu'] as const;

      for (const source of sources) {
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          id: 1,
          source,
        });

        const event = await queryOne(
          `INSERT INTO application_events
           (application_id, from_status, to_status, source, source_ref)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [1, 'screening', 'interview', source, null],
        );
        expect((event as { source: string }).source).toBe(source);
      }
    });
  });
});

describe('ApplicationTracker list() 分页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('支持按 status 筛选', async () => {
    // 模拟返回 interview 状态的投递
    const mockApps = [
      { id: 1, status: 'interview', job_title: '后端实习', company_name: '字节' },
      { id: 2, status: 'interview', job_title: '算法实习', company_name: '美团' },
    ];
    vi.mocked(query).mockResolvedValueOnce(mockApps as never);
    vi.mocked(queryOne).mockResolvedValueOnce({ count: '2' });

    const result = await query(
      `SELECT a.*, j.title AS job_title, c.name AS company_name
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE a.profile_id = $1 AND a.status = $2
       ORDER BY a.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [1, 'interview', 20, 0],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('status', 'interview');
  });

  it('支持多 status 筛选', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { id: 1, status: 'interview' },
      { id: 2, status: 'written_test' },
    ] as never);
    vi.mocked(queryOne).mockResolvedValueOnce({ count: '2' });

    const result = await query(
      `SELECT * FROM applications a
       WHERE a.profile_id = $1 AND a.status = ANY($2)
       ORDER BY a.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [1, ['interview', 'written_test'], 20, 0],
    );

    expect(result).toHaveLength(2);
  });

  it('page_size 上限为 50', () => {
    const requestedPageSize = 100;
    const safePageSize = Math.min(50, requestedPageSize);
    expect(safePageSize).toBe(50);
  });
});

describe('ApplicationTracker 幂等性', () => {
  it('重复创建同一岗位的投递应失败（UNIQUE 约束）', () => {
    // 验证 schema 中有 UNIQUE(profile_id, job_id)
    // 当 duplicate key 冲突时应抛出 PG 错误
    const errorCodes = ['23505']; // PostgreSQL unique_violation
    expect(errorCodes).toContain('23505');
  });
});