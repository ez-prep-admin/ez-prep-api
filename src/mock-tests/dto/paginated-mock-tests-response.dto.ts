import { ApiProperty } from '@nestjs/swagger';
import { MockTestResponseDto } from './mock-test-response.dto';
import { MockTestListItemDto } from './mock-test-list-item.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

/**
 * Paginated mock tests response (full details)
 */
export class PaginatedMockTestsResponseDto {
  @ApiProperty({
    description: 'Array of mock tests',
    type: [MockTestResponseDto],
  })
  data: MockTestResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}

/**
 * Paginated mock tests response (list items with populated fields)
 */
export class PaginatedMockTestListResponseDto {
  @ApiProperty({
    description: 'Array of mock test list items',
    type: [MockTestListItemDto],
  })
  data: MockTestListItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
