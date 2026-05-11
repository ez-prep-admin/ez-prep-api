import { ApiProperty } from '@nestjs/swagger';
import { TagResponseDto } from './tag-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

/**
 * Paginated tags response
 */
export class PaginatedTagsResponseDto {
  @ApiProperty({
    description: 'Array of tags',
    type: [TagResponseDto],
  })
  data: TagResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
