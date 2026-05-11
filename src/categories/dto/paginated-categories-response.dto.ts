import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

/**
 * Paginated categories response
 */
export class PaginatedCategoriesResponseDto {
  @ApiProperty({
    description: 'Array of categories',
    type: [CategoryResponseDto],
  })
  data: CategoryResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
