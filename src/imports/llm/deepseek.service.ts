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
import { DeepseekLlmResult } from './deepseek.types';

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
  ): Promise<DeepseekLlmResult> {
    const startedAt = Date.now();
    this.logger.log(`[deepseek] Single request started for Q${matched.number}`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      max_tokens: this.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: QUESTION_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildQuestionUserPrompt(matched),
        },
      ],
    });

    const result = this.toLlmResult(response);

    if (!result.content) {
      throw new Error(
        `DeepSeek returned an empty response for question ${matched.number}.`,
      );
    }

    this.logCompletion('Single', `Q${matched.number}`, startedAt, result);

    return result;
  }

  async extractQuestionsBatch(
    matchedQuestions: MatchedQuestion[],
  ): Promise<DeepseekLlmResult> {
    const startedAt = Date.now();
    const numbers = matchedQuestions
      .map(question => question.number)
      .join(', ');

    this.logger.log(
      `[deepseek] Batch request started for ${matchedQuestions.length} question(s): [${numbers}]`,
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      max_tokens: this.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildBatchQuestionUserPrompt(matchedQuestions),
        },
      ],
    });

    const result = this.toLlmResult(response);

    if (!result.content) {
      throw new Error(
        `DeepSeek returned an empty batch response for questions [${numbers}].`,
      );
    }

    this.logCompletion('Batch', `[${numbers}]`, startedAt, result);

    if (result.finishReason === 'length') {
      this.logger.warn(
        `[deepseek] Batch response truncated (finish_reason=length, completion_tokens=${result.completionTokens ?? 'n/a'}, max_output_tokens=${this.maxOutputTokens}, chars=${result.content.length})`,
      );
    }

    return result;
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
  ): void {
    this.logger.log(
      `[deepseek] ${mode} request finished for ${label} in ${Date.now() - startedAt}ms ` +
        `(tokens=${result.totalTokens ?? 'n/a'}, completion_tokens=${result.completionTokens ?? 'n/a'}, ` +
        `finish_reason=${result.finishReason ?? 'n/a'}, chars=${result.content.length})`,
    );
  }
}
