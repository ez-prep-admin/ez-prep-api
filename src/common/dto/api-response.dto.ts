import { ApiProperty } from '@nestjs/swagger';

/**
 * Pagination metadata for paginated responses
 */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevPage: boolean;
}

/**
 * Generic paginated response wrapper
 */
export class PaginatedResponseDto<T> {
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;

  constructor(data: T[], pagination: PaginationMetaDto) {
    this.data = data;
    this.pagination = pagination;
  }
}

/**
 * Generic API response wrapper with message and data
 */
export class ApiResponseDto<T> {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;

  data: T;

  constructor(message: string, data: T) {
    this.message = message;
    this.data = data;
  }
}

/**
 * Generic API response wrapper with message only (no data)
 */
export class ApiMessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}
