/**
 * OpenAI Provider Adapter
 */
import OpenAI from 'openai';
import type {
  AdapterCredentials,
  ProviderAdapter,
  ChatInput,
  ChatOutput,
  StructuredInput,
  TestResult,
  AiCapability,
} from '../types';

export class OpenAIAdapter implements ProviderAdapter {
  readonly providerKey = 'openai';

  private getClient(apiKey: string, baseUrl?: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 30_000,
    });
  }

  supports(model: string, capability: AiCapability): boolean {
    const caps: Record<string, AiCapability[]> = {
      'gpt-4o': ['chat', 'structured', 'streaming', 'vision'],
      'gpt-4-turbo': ['chat', 'structured', 'streaming', 'vision'],
      'gpt-4': ['chat', 'structured', 'streaming'],
      'gpt-3.5-turbo': ['chat', 'streaming'],
    };
    return caps[model]?.includes(capability) ?? false;
  }

  async chat(input: ChatInput, credentials: AdapterCredentials): Promise<ChatOutput> {
    const client = this.getClient(credentials.apiKey, credentials.baseUrl ?? undefined);
    const completion = await client.chat.completions.create({
      model: input.model,
      messages: input.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: input.temperature ?? 0.7,
      max_tokens: input.max_tokens,
      stream: false,
    });
    const choice = completion.choices[0];
    return {
      content: choice.message.content ?? '',
      usage: completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined,
      finish_reason: choice.finish_reason ?? undefined,
    };
  }

  async structured<T>(input: StructuredInput<T>, credentials: AdapterCredentials): Promise<T> {
    const client = this.getClient(credentials.apiKey, credentials.baseUrl ?? undefined);
    const response = await client.chat.completions.create({
      model: input.model,
      messages: input.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: input.temperature ?? 0.3,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0].message.content ?? '{}';
    return JSON.parse(content) as T;
  }

  async testConnection(apiKey: string, baseUrl?: string): Promise<TestResult> {
    const start = Date.now();
    try {
      const client = this.getClient(apiKey, baseUrl);
      await client.models.list();
      return { success: true, latency_ms: Date.now() - start };
    } catch (err) {
      return { success: false, latency_ms: Date.now() - start, error: String(err) };
    }
  }
}
