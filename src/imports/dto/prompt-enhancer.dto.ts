import { ApiProperty } from '@nestjs/swagger';
import { PROMPT_ENHANCER_IDS } from '../prompt-enhancers/prompt-enhancer.ids';

export class PromptEnhancerCatalogItemDto {
  @ApiProperty({
    description: 'Stable enhancer id used in upload/enrich requests',
    enum: PROMPT_ENHANCER_IDS,
    example: 'shared-passage',
  })
  id: string;

  @ApiProperty({
    description: 'Human-readable label for admin UI',
    example: 'Shared passage (multiple questions)',
  })
  label: string;

  @ApiProperty({
    description: 'When to use this enhancer',
    example:
      'Use when one reading passage is followed by several questions that all depend on it.',
  })
  description: string;
}
