import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { MatchedQuestion } from '../types/matched-question';
import {
  BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
  buildBatchQuestionUserPrompt,
  buildQuestionUserPrompt,
  QUESTION_EXTRACTION_SYSTEM_PROMPT,
} from '../prompt/question.prompt';
import { DeepseekLlmResult, DeepseekThinkingOptions } from './deepseek.types';

/** Default output budget for 20-question batch enrichment with LaTeX explanations */
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxOutputTokens: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL:
        this.configService.get<string>('DEEPSEEK_BASE_URL') ??
        'https://api.deepseek.com',
      timeout: 5 * 60 * 1000,
    });
    this.model =
      this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
    this.maxOutputTokens = this.resolveMaxOutputTokens();

    this.logger.log(
      `[deepseek] Client ready (model=${this.model}, timeout=300s, max_output_tokens=${this.maxOutputTokens})`,
    );
  }

  private resolveMaxOutputTokens(): number {
    const configured = this.configService.get<string | number>(
      'DEEPSEEK_MAX_OUTPUT_TOKENS',
    );
    const parsed = Number(configured ?? DEFAULT_MAX_OUTPUT_TOKENS);

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_MAX_OUTPUT_TOKENS;
  }

  async extractQuestion(matched: MatchedQuestion): Promise<string> {
    const result = await this.extractQuestionDetailed(matched);
    return result.content;
  }

  async extractQuestionDetailed(
    matched: MatchedQuestion,
    options?: { thinking?: DeepseekThinkingOptions },
  ): Promise<DeepseekLlmResult> {
    const startedAt = Date.now();
    this.logger.log(`[deepseek] Single request started for Q${matched.number}`);

    const response = await this.createChatCompletion(
      [
        {
          role: 'system',
          content: QUESTION_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildQuestionUserPrompt(matched),
        },
      ],
      options?.thinking,
    );

    const result = this.toLlmResult(response);

    if (!result.content) {
      throw new Error(
        `DeepSeek returned an empty response for question ${matched.number}.`,
      );
    }

    this.logCompletion(
      'Single',
      `Q${matched.number}`,
      startedAt,
      result,
      options?.thinking,
    );

    return result;
  }

  async extractQuestionsBatch(
    matchedQuestions: MatchedQuestion[],
    options?: { thinking?: DeepseekThinkingOptions },
  ): Promise<DeepseekLlmResult> {
    const startedAt = Date.now();
    const numbers = matchedQuestions
      .map(question => question.number)
      .join(', ');

    this.logger.log(
      `[deepseek] Batch request started for ${matchedQuestions.length} question(s): [${numbers}]` +
        this.formatThinkingSuffix(options?.thinking),
    );

    const response = await this.createChatCompletion(
      [
        {
          role: 'system',
          content: BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildBatchQuestionUserPrompt(matchedQuestions),
        },
      ],
      options?.thinking,
    );

    const result = this.toLlmResult(response);

    if (!result.content) {
      throw new Error(
        `DeepSeek returned an empty batch response for questions [${numbers}].`,
      );
    }

    this.logCompletion(
      'Batch',
      `[${numbers}]`,
      startedAt,
      result,
      options?.thinking,
    );

    if (result.finishReason === 'length') {
      this.logger.warn(
        `[deepseek] Batch response truncated (finish_reason=length, completion_tokens=${result.completionTokens ?? 'n/a'}, max_output_tokens=${this.maxOutputTokens}, chars=${result.content.length})`,
      );
    }

    return result;
  }

  private async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    thinking?: DeepseekThinkingOptions,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const request = {
      model: this.model,
      temperature: 0.1,
      max_tokens: this.maxOutputTokens,
      response_format: { type: 'json_object' as const },
      messages,
      ...(thinking?.enabled
        ? {
            thinking: { type: 'enabled' as const },
            reasoning_effort: thinking.reasoningEffort ?? 'high',
          }
        : {}),
    };

    return this.client.chat.completions.create(
      request as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    );
  }

  private toLlmResult(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): DeepseekLlmResult {
    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      promptTokens: response.usage?.prompt_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null,
    };
  }

  private logCompletion(
    mode: 'Single' | 'Batch',
    label: string,
    startedAt: number,
    result: DeepseekLlmResult,
    thinking?: DeepseekThinkingOptions,
  ): void {
    this.logger.log(
      `[deepseek] ${mode} request finished for ${label} in ${Date.now() - startedAt}ms ` +
        `(tokens=${result.totalTokens ?? 'n/a'}, completion_tokens=${result.completionTokens ?? 'n/a'}, ` +
        `finish_reason=${result.finishReason ?? 'n/a'}, chars=${result.content.length}` +
        `${this.formatThinkingSuffix(thinking)})`,
    );
  }

  private formatThinkingSuffix(thinking?: DeepseekThinkingOptions): string {
    if (!thinking?.enabled) {
      return ', thinking=disabled';
    }

    return `, thinking=enabled, reasoning_effort=${thinking.reasoningEffort ?? 'high'}`;
  }
}
