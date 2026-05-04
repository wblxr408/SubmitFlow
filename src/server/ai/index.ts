/**
 * AI 编排器
 * 统一封装所有服务商，按任务路由，自动回退
 */
import type { ChatInput, ChatOutput, ProviderAdapter, StructuredInput, TestResult } from './types';
import { createLogger } from '../../lib/logger';
import { query } from '../../lib/db';
import { safeDecrypt } from '../../lib/crypto';
import type { AiTaskType, UserAiProviderConfig, UserAiTaskRoute } from '../../types';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';

const log = createLogger('ai/orchestrator');

interface ResolvedUserAiProviderConfig extends UserAiProviderConfig {
  provider_key: string;
  adapter_type: string;
}

interface AdapterEntry {
  adapter: ProviderAdapter;
  model: string;
  config: ResolvedUserAiProviderConfig;
  fallback: string[];
}

// ============================================================
// Adapter 注册表
// ============================================================
const adapters: Record<string, ProviderAdapter> = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
};

// ============================================================
// 获取用户配置
// ============================================================
async function getUserAiConfig(profileId: number) {
  const [configs, routes] = await Promise.all([
    query<ResolvedUserAiProviderConfig>(
      `SELECT c.*, p.provider_key, p.adapter_type
       FROM user_ai_provider_configs c
       JOIN ai_providers p ON p.id = c.provider_id
       WHERE c.profile_id = $1 AND c.is_enabled = TRUE`,
      [profileId],
    ),
    query<UserAiTaskRoute>(
      `SELECT * FROM user_ai_task_routes WHERE profile_id = $1`,
      [profileId],
    ),
  ]);
  return { configs, routes };
}

async function getAdapter(profileId: number, taskType: AiTaskType): Promise<AdapterEntry | null> {
  const { configs, routes } = await getUserAiConfig(profileId);
  const route = routes.find((r) => r.task_type === taskType);

  if (route?.primary_provider_id && route.primary_model_name) {
    const config = configs.find((c) => c.provider_id === route.primary_provider_id);
    if (config) {
      const adapter = adapters[config.adapter_type];
      if (adapter) {
        return {
          adapter,
          model: route.primary_model_name,
          config,
          fallback: route.fallback_chain_json ?? [],
        };
      }
    }
  }

  const defaultConfig = configs[0];
  if (defaultConfig) {
    const adapter = adapters[defaultConfig.adapter_type];
    if (adapter) {
      return {
        adapter,
        model: 'gpt-4o',
        config: defaultConfig,
        fallback: [],
      };
    }
  }

  return null;
}

// ============================================================
// AI Orchestrator 主类
// ============================================================
export class AIOrchestrator {
  constructor(private readonly profileId: number) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const entry = await getAdapter(this.profileId, 'agent_chat');
    if (!entry) throw new Error('No AI provider configured');

    const apiKey = safeDecrypt(entry.config.api_key_encrypted) ?? '';
    if (!apiKey) {
      throw new Error('AI provider API key is missing');
    }
    const start = Date.now();
    try {
      const result = await entry.adapter.chat(
        { ...input, model: entry.model },
        { apiKey, baseUrl: entry.config.base_url },
      );
      await this.logRequest('agent_chat', entry, 'success', Date.now() - start, result.usage);
      return result;
    } catch (err) {
      await this.logRequest('agent_chat', entry, 'failed', Date.now() - start, undefined, String(err));
      throw err;
    }
  }

  async structured<T>(input: StructuredInput<T>): Promise<T> {
    const entry = await getAdapter(this.profileId, 'jd_tagging');
    if (!entry) throw new Error('No AI provider configured');

    const apiKey = safeDecrypt(entry.config.api_key_encrypted) ?? '';
    if (!apiKey) {
      throw new Error('AI provider API key is missing');
    }
    const start = Date.now();
    try {
      const result = await entry.adapter.structured(
        { ...input, model: entry.model },
        { apiKey, baseUrl: entry.config.base_url },
      ) as T;
      await this.logRequest('jd_tagging', entry, 'success', Date.now() - start);
      return result;
    } catch (err) {
      await this.logRequest('jd_tagging', entry, 'failed', Date.now() - start, undefined, String(err));
      throw err;
    }
  }

  async emailParse(input: ChatInput) {
    const entry = await getAdapter(this.profileId, 'email_parse');
    if (!entry) throw new Error('No AI provider configured');

    const apiKey = safeDecrypt(entry.config.api_key_encrypted) ?? '';
    if (!apiKey) {
      throw new Error('AI provider API key is missing');
    }
    const start = Date.now();
    try {
      const result = await entry.adapter.chat(
        { ...input, model: entry.model },
        { apiKey, baseUrl: entry.config.base_url },
      );
      await this.logRequest('email_parse', entry, 'success', Date.now() - start);
      return result;
    } catch (err) {
      await this.logRequest('email_parse', entry, 'failed', Date.now() - start, undefined, String(err));
      throw err;
    }
  }

  private async logRequest(
    taskType: AiTaskType,
    entry: AdapterEntry,
    status: 'success' | 'failed',
    latencyMs: number,
    usage?: { total_tokens: number },
    errorCode?: string,
  ) {
    try {
      await query(
        `INSERT INTO ai_request_logs
         (profile_id, task_type, provider_id, model_name, status, latency_ms, token_usage_json, estimated_cost, error_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          this.profileId,
          taskType,
          entry.config.provider_id,
          entry.model,
          status,
          latencyMs,
          usage ? JSON.stringify(usage) : null,
          null, // estimated_cost
          errorCode ?? null,
        ],
      );
    } catch (err) {
      log.error({ err }, 'Failed to log AI request');
    }
  }
}

export async function testProviderConnection(
  providerKey: string,
  apiKey: string,
  baseUrl?: string,
): Promise<TestResult> {
  const adapter = adapters[providerKey];
  if (!adapter) return { success: false, latency_ms: 0, error: 'Unknown provider' };
  return adapter.testConnection(apiKey, baseUrl);
}
