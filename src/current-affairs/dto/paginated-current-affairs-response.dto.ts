import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { CurrentAffairResponseDto } from './current-affair-response.dto';

/**
 * Service-layer paginated payload (no envelope message).
 */
export class PaginatedCurrentAffairsResponseDto {
  @ApiProperty({
    description: 'Array of current affairs items for this page',
    type: [CurrentAffairResponseDto],
  })
  data: CurrentAffairResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata. `limit` is capped at 100.',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}

export class CurrentAffairApiResponseDto {
  @ApiProperty({
    description: 'Human-readable result',
    example: 'Current affair created successfully',
  })
  message: string;

  @ApiProperty({ type: CurrentAffairResponseDto })
  data: CurrentAffairResponseDto;
}

export class CurrentAffairsListApiResponseDto {
  @ApiProperty({
    description:
      'Human-readable result. Includes the filtered date when `date` was provided.',
    example: 'Current affairs for 2026-08-14 retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description:
      'Items for this page, ordered by `sortOrder` then `createdAt` when `date` is set; otherwise by `date` descending.',
    type: [CurrentAffairResponseDto],
  })
  data: CurrentAffairResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
