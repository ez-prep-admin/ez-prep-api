import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { AppUserListItemDto } from './app-user-list-item.dto';

export class PaginatedAppUsersResponseDto {
  @ApiProperty({ type: [AppUserListItemDto] })
  data: AppUserListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

export class AppUsersListApiResponseDto {
  @ApiProperty({
    example: 'App users retrieved successfully',
  })
  message: string;

  @ApiProperty({ type: [AppUserListItemDto] })
  data: AppUserListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
