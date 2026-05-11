import { ApiProperty } from '@nestjs/swagger';
import { ExamResponseDto } from './exam-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

/**
 * Paginated exams response
 */
export class PaginatedExamsResponseDto {
  @ApiProperty({
    description: 'Array of exams',
    type: [ExamResponseDto],
  })
  data: ExamResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
