import { ApiProperty } from '@nestjs/swagger';
import { SubjectResponseDto } from './subject-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

export class PaginatedSubjectsResponseDto {
  @ApiProperty({
    description: 'Array of subjects',
    type: [SubjectResponseDto],
  })
  data: SubjectResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
