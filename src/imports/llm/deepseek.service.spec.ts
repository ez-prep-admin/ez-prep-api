import { ConfigService } from '@nestjs/config';
import { DeepseekService } from './deepseek.service';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  })),
}));

describe('DeepseekService', () => {
  const matched = {
    number: 1,
    question: 'What is 2+2?',
    solution: '4',
  };

  const completion = {
    choices: [
      {
        message: { content: '{"ok":true}' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      completion_tokens: 10,
      prompt_tokens: 20,
      total_tokens: 30,
    },
  };

  function buildService(config: Record<string, unknown> = {}) {
    const configService = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, unknown> = {
          DEEPSEEK_API_KEY: 'sk-test',
          DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
          DEEPSEEK_MODEL: 'deepseek-chat',
          DEEPSEEK_MAX_OUTPUT_TOKENS: 1000,
          ...config,
        };
        return defaults[key];
      }),
    } as unknown as ConfigService;
    return new DeepseekService(configService);
  }

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(completion);
  });

  it('requires DEEPSEEK_API_KEY', () => {
    expect(
      () =>
        new DeepseekService({
          get: () => undefined,
        } as unknown as ConfigService),
    ).toThrow(/DEEPSEEK_API_KEY/);
  });

  it('extractQuestion returns content', async () => {
    const service = buildService();
    await expect(service.extractQuestion(matched)).resolves.toBe('{"ok":true}');
  });

  it('extractQuestionDetailed throws on empty content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
    });
    const service = buildService();
    await expect(service.extractQuestionDetailed(matched)).rejects.toThrow(
      /empty response/,
    );
  });

  it('extractQuestionsBatch sends batch prompts and thinking options', async () => {
    const service = buildService({
      DEEPSEEK_MAX_OUTPUT_TOKENS: 'not-a-number',
    });
    const result = await service.extractQuestionsBatch([matched], {
      thinking: { enabled: true, reasoningEffort: 'high' },
    });

    expect(result.content).toBe('{"ok":true}');
    expect(result.finishReason).toBe('stop');
    expect(result.totalTokens).toBe(30);
    const request = mockCreate.mock.calls[0][0];
    expect(request.thinking).toEqual({ type: 'enabled' });
    expect(request.max_tokens).toBeGreaterThanOrEqual(32768);
  });

  it('warns when batch finish_reason is length', async () => {
    mockCreate.mockResolvedValue({
      ...completion,
      choices: [
        {
          message: { content: '{"partial":true}' },
          finish_reason: 'length',
        },
      ],
    });
    const service = buildService();
    const result = await service.extractQuestionsBatch([matched]);
    expect(result.finishReason).toBe('length');
  });

  it('throws on empty batch content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null }, finish_reason: 'stop' }],
    });
    const service = buildService();
    await expect(service.extractQuestionsBatch([matched])).rejects.toThrow(
      /empty batch response/,
    );
  });

  it('falls back to default base URL, model, and output tokens', async () => {
    const service = buildService({
      DEEPSEEK_BASE_URL: undefined,
      DEEPSEEK_MODEL: undefined,
      DEEPSEEK_MAX_OUTPUT_TOKENS: undefined,
    });
    await service.extractQuestion(matched);
    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('deepseek-chat');
    expect(request.max_tokens).toBe(16384);
  });

  it('treats non-positive max output tokens as the default', async () => {
    const service = buildService({ DEEPSEEK_MAX_OUTPUT_TOKENS: 0 });
    await service.extractQuestion(matched);
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(16384);
  });

  it('defaults reasoning effort and handles missing choice fields', async () => {
    mockCreate.mockResolvedValue({ choices: [{}] });
    const service = buildService();
    await expect(
      service.extractQuestionDetailed(matched, {
        thinking: { enabled: true },
      }),
    ).rejects.toThrow(/empty response/);
    const request = mockCreate.mock.calls[0][0];
    expect(request.reasoning_effort).toBe('high');
  });
});
