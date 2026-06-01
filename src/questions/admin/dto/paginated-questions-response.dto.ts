import { ApiProperty } from '@nestjs/swagger';
import { QuestionResponseDto } from './question-response.dto';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto';

export class PaginatedQuestionsResponseDto {
  @ApiProperty({ type: [QuestionResponseDto] })
  data: QuestionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
