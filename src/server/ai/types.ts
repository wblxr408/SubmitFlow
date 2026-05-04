/**
 * AI 编排层
 * 统一的 ProviderAdapter 接口 + TaskRouter + 服务商适配器
 */

// ============================================================
// 统一错误码
// ============================================================
export const AI_ERROR_CODES = {
  INVALID_API_KEY: 'AI_INVALID_API_KEY',
  RATE_LIMIT: 'AI_RATE_LIMIT',
  MODEL_NOT_FOUND: 'AI_MODEL_NOT_FOUND',
  NO_STRUCTURED_OUTPUT: 'AI_NO_STRUCTURED_OUTPUT',
  SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  TIMEOUT: 'AI_TIMEOUT',
} as const;

// ============================================================
// Capability 定义
// ============================================================
export type AiCapability = 'chat' | 'structured' | 'streaming' | 'vision';

// ============================================================
// Adapter 接口
// ============================================================
export interface ChatInput {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatOutput {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

export interface StructuredInput<T> {
  model: string;
  messages: Array<{ role: string; content: string }>;
  schema: Record<string, unknown>;
  temperature?: number;
  max_tokens?: number;
}

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  model?: string;
}

export interface AdapterCredentials {
  apiKey: string;
  baseUrl?: string | null;
}

export interface ProviderAdapter {
  providerKey: string;
  supports(model: string, capability: AiCapability): boolean;
  chat(input: ChatInput, credentials: AdapterCredentials): Promise<ChatOutput>;
  structured<T>(input: StructuredInput<T>, credentials: AdapterCredentials): Promise<T>;
  testConnection(apiKey: string, baseUrl?: string): Promise<TestResult>;
}
