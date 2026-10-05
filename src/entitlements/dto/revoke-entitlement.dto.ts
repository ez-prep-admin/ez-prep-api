import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeEntitlementDto {
  @ApiPropertyOptional({ example: 'support revoke' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
