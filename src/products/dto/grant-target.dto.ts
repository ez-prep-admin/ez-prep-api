import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

export class GrantTargetDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  id: string;

  @ApiProperty({ example: 'Topic · Polity set' })
  label: string;
}

export class GrantTargetsApiResponseDto {
  @ApiProperty({ example: 'Grant targets retrieved successfully' })
  message: string;

  @ApiProperty({ type: [GrantTargetDto] })
  data: GrantTargetDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
