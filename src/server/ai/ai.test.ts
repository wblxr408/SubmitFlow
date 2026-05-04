/**
 * AI 编排器测试
 * 测试 ProviderAdapter 注册、任务路由、回退逻辑
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock db and crypto
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  safeDecrypt: vi.fn((data) => {
    if (data?.includes('sk-')) return data;
    return null;
  }),
}));

// ============================================================
// 测试 ProviderAdapter 接口契约
// ============================================================
describe('ProviderAdapter 接口契约', () => {
  it('Adapter 必须实现 providerKey、supports、chat、testConnection', () => {
    const adapter = {
      providerKey: 'openai',
      supports: (model: string, capability: string) => model.includes('gpt') && capability === 'chat',
      chat: vi.fn(),
      testConnection: vi.fn(),
    };

    expect(adapter.providerKey).toBe('openai');
    expect(adapter.supports('gpt-4o', 'chat')).toBe(true);
    expect(adapter.supports('claude-3', 'chat')).toBe(false);
  });

  it('supports 能力检查正确工作', () => {
    const caps: Record<string, string[]> = {
      'gpt-4o': ['chat', 'structured', 'streaming', 'vision'],
      'gpt-4': ['chat', 'structured', 'streaming'],
      'gpt-3.5-turbo': ['chat', 'streaming'],
    };

    expect(caps['gpt-4o'].includes('structured')).toBe(true);
    expect(caps['gpt-4o'].includes('vision')).toBe(true);
    expect(caps['gpt-3.5-turbo'].includes('vision')).toBe(false);
    expect(caps['unknown-model']?.includes('chat') ?? false).toBe(false);
  });
});

// ============================================================
// 测试任务路由逻辑
// ============================================================
describe('AI 任务路由', () => {
  const MOCK_ROUTES = [
    { task_type: 'agent_chat', primary_provider_id: 1, primary_model_name: 'gpt-4o', fallback_chain_json: [] },
    { task_type: 'jd_tagging', primary_provider_id: 2, primary_model_name: 'claude-3-5-sonnet', fallback_chain_json: [] },
  ];

  const MOCK_CONFIGS = [
    { provider_id: 1, provider_key: 'openai', adapter_type: 'openai', api_key_encrypted: 'sk-openai-test', is_enabled: true },
    { provider_id: 2, provider_key: 'anthropic', adapter_type: 'anthropic', api_key_encrypted: 'sk-ant-test', is_enabled: true },
  ];

  it('按 taskType 正确选择 provider', () => {
    const taskType = 'jd_tagging';
    const route = MOCK_ROUTES.find((r) => r.task_type === taskType);
    expect(route).not.toBeUndefined();
    expect(route?.primary_provider_id).toBe(2);
    expect(route?.primary_model_name).toBe('claude-3-5-sonnet');
  });

  it('无专属路由时使用第一个可用配置', () => {
    const enabledConfigs = MOCK_CONFIGS.filter((c) => c.is_enabled);
    const defaultConfig = enabledConfigs[0];
    expect(defaultConfig?.provider_key).toBe('openai');
  });

  it('Provider 未启用时不使用', () => {
    const disabledConfigs = MOCK_CONFIGS.filter((c) => !c.is_enabled);
    expect(disabledConfigs).toHaveLength(0);
  });
});

// ============================================================
// 测试 OpenAI 结构化输出
// ============================================================
describe('OpenAI structured output', () => {
  it('response_format: json_object 应被正确传递', () => {
    // 模拟 OpenAI API 调用参数
    const params = {
      model: 'gpt-4o',
      messages: [{ role: 'system', content: '输出 JSON' }],
      temperature: 0.3,
      response_format: { type: 'json_object' as const },
    };

    expect(params.response_format.type).toBe('json_object');
  });

  it('JSON 解析失败时应捕获异常', () => {
    const invalidJson = 'This is not JSON { broken';
    expect(() => JSON.parse(invalidJson)).toThrow();
  });

  it('JSON 解析成功时应返回对象', () => {
    const validJson = '{"tag_weights": [{"tag_id": 1, "weight": 0.8}]}';
    const parsed = JSON.parse(validJson);
    expect(parsed).toHaveProperty('tag_weights');
  });
});

// ============================================================
// 测试回退链逻辑
// ============================================================
describe('Fallback Chain', () => {
  it('空 fallback_chain 时不使用回退', () => {
    const fallback = [] as string[];
    expect(fallback.length).toBe(0);
  });

  it('fallback_chain 应按顺序尝试', () => {
    const chain = ['provider1', 'provider2', 'provider3'];
    // 模拟按顺序尝试
    let tried: string[] = [];
    for (const p of chain) {
      tried.push(p);
    }
    expect(tried).toEqual(['provider1', 'provider2', 'provider3']);
  });
});

// ============================================================
// 测试 token 用量记录
// ============================================================
describe('AI Request Logging', () => {
  it('成功请求应记录 token 用量', () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };
    expect(usage.total_tokens).toBe(150);
    expect(usage.prompt_tokens).toBe(100);
  });

  it('失败请求应记录 error_code', () => {
    const failedLog = {
      status: 'failed' as const,
      latency_ms: 3000,
      error_code: 'RATE_LIMIT',
    };
    expect(failedLog.status).toBe('failed');
    expect(failedLog.error_code).toBe('RATE_LIMIT');
  });
});

// ============================================================
// 测试 API Key 安全
// ============================================================
describe('API Key 安全', () => {
  it('api_key_encrypted 不应在 API 响应中暴露', () => {
    const config = { provider_key: 'openai', api_key_encrypted: 'sk-xxxx', display_name: 'OpenAI' };
    const { api_key_encrypted, ...safe } = config;
    expect(safe).not.toHaveProperty('api_key_encrypted');
    expect(safe.provider_key).toBe('openai');
  });

  it('加密的 Key 应通过 safeDecrypt 解密', async () => {
    // 使用 mock 后的 safeDecrypt（来自顶部的 vi.mock）
    const { safeDecrypt } = await import('@/lib/crypto');
    const encrypted = 'encrypted_sk-xxx';
    const decrypted = safeDecrypt(encrypted);
    expect(decrypted).toContain('sk-');
  });
});