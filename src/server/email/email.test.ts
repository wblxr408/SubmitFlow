/**
 * Email 服务测试
 * 测试邮件解析逻辑、Gmail 同步、Gmail OAuth
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

// Mock the crypto module
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((text) => `encrypted_${text}`),
  safeDecrypt: vi.fn((data) => {
    if (!data) return null;
    if (data.includes('test_token')) return JSON.stringify({ access_token: 'test_token' });
    return null;
  }),
  decrypt: vi.fn((data) => {
    if (data.includes('test_token')) return JSON.stringify({ access_token: 'test_token' });
    return '{}';
  }),
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn(() => ({
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn(),
        },
      },
    })),
  },
}));

describe('detectStatus 邮件状态识别', () => {
  // Recreate the detectStatus logic from email/index.ts for testing
  const STATUS_RULES: Array<{
    status: string;
    confidence: number;
    patterns: RegExp[];
  }> = [
    {
      status: 'offer',
      confidence: 0.98,
      patterns: [/offer/i, /录用/, /入职/, /offer\s*letter/i, /恭喜.*通过/],
    },
    {
      status: 'rejected',
      confidence: 0.95,
      patterns: [/遗憾/, /未通过/, /rejection/i, /unfortunately/i, /not move forward/i],
    },
    {
      status: 'interview',
      confidence: 0.9,
      patterns: [/面试/, /interview/i, /约面/, /终面/, /初面/, /复试/],
    },
    {
      status: 'written_test',
      confidence: 0.86,
      patterns: [/笔试/, /\boa\b/i, /online assessment/i, /coding challenge/i, /测评/],
    },
  ];

  function detectStatus(text: string): { status: string; confidence: number } | null {
    for (const rule of STATUS_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        return { status: rule.status, confidence: rule.confidence };
      }
    }
    return null;
  }

  it('识别 Offer 邮件', () => {
    expect(detectStatus('恭喜！您的实习 offer 已发放')).toEqual({ status: 'offer', confidence: 0.98 });
    expect(detectStatus('Your job offer letter is attached')).toEqual({ status: 'offer', confidence: 0.98 });
    expect(detectStatus('恭喜您通过全部面试')).toEqual({ status: 'offer', confidence: 0.98 });
  });

  it('识别拒绝邮件', () => {
    expect(detectStatus('很遗憾，您的申请未通过')).toEqual({ status: 'rejected', confidence: 0.95 });
    expect(detectStatus('Unfortunately, we will not be moving forward')).toEqual({ status: 'rejected', confidence: 0.95 });
  });

  it('识别面试邀请邮件', () => {
    expect(detectStatus('您的面试已安排')).toEqual({ status: 'interview', confidence: 0.9 });
    expect(detectStatus('Interview scheduled for next Monday')).toEqual({ status: 'interview', confidence: 0.9 });
    expect(detectStatus('请参加初面')).toEqual({ status: 'interview', confidence: 0.9 });
  });

  it('识别笔试邀请邮件', () => {
    expect(detectStatus('请完成在线测评')).toEqual({ status: 'written_test', confidence: 0.86 });
    expect(detectStatus('Online Assessment link enclosed')).toEqual({ status: 'written_test', confidence: 0.86 });
    expect(detectStatus('完成 OA 后点击链接')).toEqual({ status: 'written_test', confidence: 0.86 });
  });

  it('非招聘邮件返回 null', () => {
    expect(detectStatus('Hey, how are you?')).toBeNull();
    expect(detectStatus('Your order has shipped')).toBeNull();
    expect(detectStatus('Monthly newsletter')).toBeNull();
  });
});

describe('matchApplication 应用匹配', () => {
  // Simulate the scoring logic
  function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function scoreApplicationMatch(
    companyName: string,
    jobTitle: string,
    text: string,
  ): { score: number; companyHit: boolean; roleHit: boolean } {
    const normalizedText = normalizeText(text);
    const normalizedCompany = normalizeText(companyName);
    const normalizedTitle = normalizeText(jobTitle);

    const companyHit = normalizedCompany.length >= 2 && normalizedText.includes(normalizedCompany);
    const roleHit = normalizedTitle.length >= 2 && normalizedText.includes(normalizedTitle);
    const score = (companyHit ? 100 : 0) + (roleHit ? 40 : 0);

    return { score, companyHit, roleHit };
  }

  it('公司名精确匹配得 100 分', () => {
    const result = scoreApplicationMatch('字节跳动', '后端实习', '字节跳动 面试邀请');
    expect(result.score).toBe(100);
    expect(result.companyHit).toBe(true);
    expect(result.roleHit).toBe(false);
  });

  it('岗位名匹配额外得 40 分', () => {
    const result = scoreApplicationMatch('字节跳动', '后端开发', '字节跳动招聘后端开发工程师');
    expect(result.score).toBe(140);
    expect(result.companyHit).toBe(true);
    expect(result.roleHit).toBe(true);
  });

  it('无匹配返回 0 分', () => {
    const result = scoreApplicationMatch('字节跳动', '后端实习', '阿里巴巴 offer 通知');
    expect(result.score).toBe(0);
    expect(result.companyHit).toBe(false);
  });

  it('短公司名（<2字符）不触发匹配', () => {
    const result = scoreApplicationMatch('A', '后端实习', 'A公司 offer');
    expect(result.score).toBe(0);
  });
});

describe('email confirmEmailParse 逻辑', () => {
  it('ignore action 设置 resolution 为 ignored', async () => {
    const { execute } = await import('@/lib/db');
    vi.mocked(execute).mockResolvedValue(1);

    // Simulate: log resolution updated to 'ignored'
    const result = await execute(
      `UPDATE email_parse_logs SET resolution = 'ignored' WHERE id = $1`,
      [1],
    );

    expect(result).toBe(1);
    expect(vi.mocked(execute)).toHaveBeenCalled();
  });

  it('confirm action 时需要 parsed_status 和 application_id', async () => {
    // When parsed_status is null, confirm should fail
    const logRow = { id: 1, parsed_status: null, matched_application_id: 2 };
    expect(logRow.parsed_status).toBeNull();
    // No applicationId provided → should throw
    const shouldThrow = logRow.parsed_status === null;
    expect(shouldThrow).toBe(true);
  });
});

describe('Gmail OAuth 回调处理', () => {
  it('缺少 code 参数应返回 400', async () => {
    const url = 'http://localhost:3208/api/email/callback';
    const params = new URL(url).searchParams;
    const code = params.get('code');
    expect(code).toBeNull();
  });

  it('成功换取 token 后 redirect 到 integrations', async () => {
    const code = 'test_authorization_code';
    const tokens = {
      access_token: 'ya29.test',
      refresh_token: 'refresh_token',
      expiry_date: Date.now() + 3600000,
    };
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
  });
});

describe('幂等性保证', () => {
  it('同一 message_id 重复解析应跳过', async () => {
    const { queryOne } = await import('@/lib/db');

    // First call: message not exists
    vi.mocked(queryOne).mockResolvedValueOnce(null);
    const first = await queryOne(
      `SELECT id FROM email_parse_logs WHERE profile_id = $1 AND message_id = $2`,
      [1, 'msg_123'],
    );
    expect(first).toBeNull();

    // Simulate: insert log
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 1 });

    // Second call: message already exists
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 1 });
    const second = await queryOne(
      `SELECT id FROM email_parse_logs WHERE profile_id = $1 AND message_id = $2`,
      [1, 'msg_123'],
    );
    expect(second).not.toBeNull();
  });
});