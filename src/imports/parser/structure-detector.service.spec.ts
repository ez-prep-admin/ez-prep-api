import { ConfigService } from '@nestjs/config';
import { StructureDetectorService } from './structure-detector.service';
import { DEFAULT_CONTENT_PROFILE } from '../utils/content-profile.util';

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

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    questionPattern: {
      type: 'numbered',
      regex: '^Q\\.(\\d+)',
      exampleMatch: 'Q.1',
      prefix: null,
    },
    solutionPattern: {
      location: 'separate',
      marker: null,
      inlineFormat: null,
      matchesQuestionNumbering: true,
      numberingRegex: null,
    },
    delimiter: {
      type: 'blank-line',
      value: null,
      confidence: 0.9,
    },
    metadata: {
      hasDifficulty: false,
      hasMarks: false,
      hasSubjectLabels: false,
      examType: null,
    },
    detectedFormat: 'SSC',
    confidence: 0.8,
    warnings: [],
    contentProfile: {
      requiresReasoning: true,
      reasoningDomains: ['mathematics'],
      reasoningEffort: 'high',
      detectedSubjects: ['maths'],
      confidence: 0.7,
      rationale: 'geometry heavy',
    },
    ...overrides,
  };
}

describe('StructureDetectorService', () => {
  function buildService(config: Record<string, unknown> = {}) {
    const configService = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, unknown> = {
          DEEPSEEK_API_KEY: 'sk-test',
          DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
          DEEPSEEK_MODEL: 'deepseek-chat',
          ...config,
        };
        return defaults[key];
      }),
    } as unknown as ConfigService;
    return new StructureDetectorService(configService);
  }

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('requires DEEPSEEK_API_KEY (missing client)', () => {
    expect(
      () =>
        new StructureDetectorService({
          get: () => undefined,
        } as unknown as ConfigService),
    ).toThrow(/DEEPSEEK_API_KEY/);
  });

  it('defaults base URL and model when omitted', () => {
    expect(() =>
      buildService({
        DEEPSEEK_BASE_URL: undefined,
        DEEPSEEK_MODEL: undefined,
      }),
    ).not.toThrow();
  });

  it('detects structure from a valid LLM JSON payload', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validPayload()) } }],
      usage: { total_tokens: 12 },
    });
    const service = buildService();
    const result = await service.detectStructure('Q.1 What is 2+2?\n(a) 4');
    expect(result.detectedFormat).toBe('SSC');
    expect(result.contentProfile?.requiresReasoning).toBe(true);
    expect(result.contentProfile?.rationale).toBe('geometry heavy');
  });

  it('normalizes LLM pattern aliases and null rationale', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(
              validPayload({
                questionPattern: {
                  type: 'Hierarchical numbering',
                  regex: '^## Q\\d+',
                  exampleMatch: '## Q1',
                },
                solutionPattern: {
                  location: 'inline answers',
                  matchesQuestionNumbering: 'true',
                },
                delimiter: {
                  type: 'heading marker',
                  value: '## Q',
                  confidence: '0.5',
                },
                warnings: ['check numbering'],
                contentProfile: {
                  requiresReasoning: false,
                  reasoningDomains: [],
                  confidence: 0.2,
                  rationale: null,
                },
              }),
            ),
          },
        },
      ],
    });
    const service = buildService();
    const result = await service.detectStructure('## Q1 Hello');
    expect(result.questionPattern.type).toBeTruthy();
    expect(result.warnings?.length).toBeGreaterThanOrEqual(0);
    expect(result.contentProfile?.rationale).toBeUndefined();
  });

  it('normalizes end-of-page location and numbered fallback type', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(
              validPayload({
                questionPattern: {
                  type: 'something else',
                  regex: '^Q\\.(\\d+)',
                  exampleMatch: 'Q.1',
                },
                solutionPattern: {
                  location: 'end of page',
                  matchesQuestionNumbering: false,
                },
                delimiter: { type: 'paragraph gap', value: '', confidence: 1 },
              }),
            ),
          },
        },
      ],
    });
    const service = buildService();
    await expect(service.detectStructure('Q.1 x')).resolves.toBeDefined();
  });

  it('throws when choices have no message content', async () => {
    mockCreate.mockResolvedValue({ choices: [{}] });
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toThrow(/empty response/);
  });

  it('normalizes labeled / mixed / end-of-page / marker / page-break aliases', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(
              validPayload({
                questionPattern: {
                  type: 'label based',
                  regex: '^Q\\.(\\d+)',
                  exampleMatch: 'Q.1',
                },
                solutionPattern: {
                  location: 'mixed end of page',
                  matchesQuestionNumbering: false,
                },
                delimiter: { type: 'page break', value: '', confidence: 1 },
                contentProfile: {
                  requiresReasoning: false,
                  reasoningDomains: [],
                  confidence: 0,
                },
              }),
            ),
          },
        },
      ],
    });
    const service = buildService();
    await expect(service.detectStructure('Q.1 x')).resolves.toBeDefined();
  });

  it('normalizes distinct/section solution location and marker delimiter', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(
              validPayload({
                questionPattern: {
                  type: 12,
                  regex: '^Q\\.(\\d+)',
                  exampleMatch: 'Q.1',
                },
                solutionPattern: {
                  location: 99,
                  matchesQuestionNumbering: true,
                },
                delimiter: { type: 5, value: '---', confidence: 1 },
              }),
            ),
          },
        },
      ],
    });
    const service = buildService();
    await expect(service.detectStructure('Q.1 x')).resolves.toBeDefined();
  });

  it('falls back to default content profile when omitted', async () => {
    const payload = validPayload();
    delete (payload as { contentProfile?: unknown }).contentProfile;
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
    const service = buildService();
    const result = await service.detectStructure('Q.1 x');
    expect(result.contentProfile).toEqual(DEFAULT_CONTENT_PROFILE);
  });

  it('throws on empty LLM content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toThrow(/empty response/);
  });

  it('throws on invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{not-json' } }],
    });
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toThrow(
      /Failed to parse structure detection response/,
    );
  });

  it('throws when JSON fails schema validation', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ nope: true }) } }],
    });
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toThrow(
      /Structure detection response validation failed/,
    );
  });

  it('rethrows non-Error failures from the client', async () => {
    mockCreate.mockRejectedValue('upstream');
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toBe('upstream');
  });

  it('rethrows Error failures from the client', async () => {
    mockCreate.mockRejectedValue(new Error('timeout'));
    const service = buildService();
    await expect(service.detectStructure('md')).rejects.toThrow('timeout');
  });

  it('validatePattern returns true for matching regex', () => {
    const service = buildService();
    expect(service.validatePattern('^Q\\.\\d+', 'Q.12 Hello')).toBe(true);
  });

  it('validatePattern returns false for non-matching or invalid regex', () => {
    const service = buildService();
    expect(service.validatePattern('^Q\\.\\d+', 'Sol.1')).toBe(false);
    expect(service.validatePattern('(', 'Q.1')).toBe(false);
  });

  it('logs n/a tokens when usage is missing', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validPayload()) } }],
    });
    const service = buildService();
    await expect(
      service.detectStructure('Q.1', { maxChars: 100, maxLines: 10 }),
    ).resolves.toBeDefined();
  });
});
