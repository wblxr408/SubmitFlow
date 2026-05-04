/**
 * Anthropic Provider Adapter
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  AdapterCredentials,
  ProviderAdapter,
  ChatInput,
  ChatOutput,
  StructuredInput,
  TestResult,
  AiCapability,
} from '../types';

export class AnthropicAdapter implements ProviderAdapter {
  readonly providerKey = 'anthropic';

  private getClient(apiKey: string, baseUrl?: string): Anthropic {
    return new Anthropic({
      apiKey,
      baseURL: baseUrl,
      timeout: 30_000,
    });
  }

  supports(model: string, capability: AiCapability): boolean {
    const caps: Record<string, AiCapability[]> = {
      'claude-sonnet-4-20250514': ['chat', 'structured', 'vision'],
      'claude-3-5-sonnet-latest': ['chat', 'structured', 'vision'],
      'claude-3-opus-latest': ['chat', 'structured', 'vision'],
      'claude-3-haiku-latest': ['chat'],
    };
    return caps[model]?.includes(capability) ?? false;
  }

  async chat(input: ChatInput, credentials: AdapterCredentials): Promise<ChatOutput> {
    const client = this.getClient(credentials.apiKey, credentials.baseUrl ?? undefined);
    const system = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages = input.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })) as Anthropic.MessageParam[];
    const response = await client.messages.create({
      model: input.model,
      max_tokens: input.max_tokens ?? 1024,
      system: system || undefined,
      messages,
      temperature: input.temperature ?? 0.7,
    });
    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '';
    return {
      content: text,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async structured<T>(input: StructuredInput<T>, credentials: AdapterCredentials): Promise<T> {
    const client = this.getClient(credentials.apiKey, credentials.baseUrl ?? undefined);
    const systemWithSchema = `You must respond with valid JSON matching this schema: ${JSON.stringify(input.schema)}`;
    const system = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages = input.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })) as Anthropic.MessageParam[];
    const response = await client.messages.create({
      model: input.model,
      max_tokens: input.max_tokens ?? 1024,
      system: system ? `${system}\n\n${systemWithSchema}` : systemWithSchema,
      messages,
      temperature: input.temperature ?? 0.3,
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text) as T;
  }

  async testConnection(apiKey: string, baseUrl?: string): Promise<TestResult> {
    const start = Date.now();
    try {
      const client = this.getClient(apiKey, baseUrl);
      await client.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { success: true, latency_ms: Date.now() - start };
    } catch (err) {
      return { success: false, latency_ms: Date.now() - start, error: String(err) };
    }
  }
}
