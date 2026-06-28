import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export class DeepseekService {
  openai: OpenAI;
  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
      baseURL: this.configService.get('DEEPSEEK_BASE_URL'),
      defaultHeaders: {
        Authorization: `Bearer ${this.configService.get('DEEPSEEK_API_KEY')}`,
      },
    });
  }
}
