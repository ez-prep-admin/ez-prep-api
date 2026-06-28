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

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly client: OpenAI;
  private readonly model: string;

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

    this.logger.log(
      `[deepseek] Client ready (model=${this.model}, timeout=300s)`,
    );
  }

  async extractQuestion(matched: MatchedQuestion): Promise<string> {
    const startedAt = Date.now();
    this.logger.log(`[deepseek] Single request started for Q${matched.number}`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
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

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(
        `DeepSeek returned an empty response for question ${matched.number}.`,
      );
    }

    this.logger.log(
      `[deepseek] Single request finished for Q${matched.number} in ${Date.now() - startedAt}ms (tokens=${response.usage?.total_tokens ?? 'n/a'})`,
    );

    return content;
  }

  async extractQuestionsBatch(
    matchedQuestions: MatchedQuestion[],
  ): Promise<string> {
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

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(
        `DeepSeek returned an empty batch response for questions [${numbers}].`,
      );
    }

    this.logger.log(
      `[deepseek] Batch request finished in ${Date.now() - startedAt}ms (tokens=${response.usage?.total_tokens ?? 'n/a'}, chars=${content.length})`,
    );

    return content;
  }
}
