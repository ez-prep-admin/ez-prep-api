import { ApiPropertyOptional } from '@nestjs/swagger';
import { SafeQuestionDto } from '../../mock-test-attempts/dto/start-attempt-response.dto';

export class SearchQuestionItemDto extends SafeQuestionDto {
  @ApiPropertyOptional({
    description: 'English snippet for the replace picker',
    example: 'What is the powerhouse of the cell?',
  })
  snippet?: string;
}
