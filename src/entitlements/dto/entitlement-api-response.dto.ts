import { ApiProperty } from '@nestjs/swagger';
import { EntitlementResponseDto } from './entitlement-response.dto';

export class EntitlementListApiResponseDto {
  @ApiProperty({ example: 'Entitlements retrieved successfully' })
  message: string;

  @ApiProperty({ type: [EntitlementResponseDto] })
  data: EntitlementResponseDto[];
}

export class EntitlementApiResponseDto {
  @ApiProperty({ example: 'Entitlement granted successfully' })
  message: string;

  @ApiProperty({ type: EntitlementResponseDto })
  data: EntitlementResponseDto;
}
