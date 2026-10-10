import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../../common/enums/entitlement-status.enum';

export class EntitlementResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  userId: string;

  @ApiProperty({ enum: EntitlementScopeType })
  @Expose()
  scopeType: EntitlementScopeType;

  @ApiProperty()
  @Expose()
  scopeId: string;

  @ApiProperty({ enum: EntitlementStatus })
  @Expose()
  status: EntitlementStatus;

  @ApiProperty()
  @Expose()
  startsAt: Date;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  expiresAt: Date | null;

  @ApiProperty({ enum: EntitlementSourceType })
  @Expose()
  sourceType: EntitlementSourceType;

  @ApiPropertyOptional()
  @Expose()
  sourceId?: string;

  @ApiPropertyOptional()
  @Expose()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Product name at read time. Omitted for support grants.',
  })
  @Expose()
  productName?: string;

  @ApiPropertyOptional()
  @Expose()
  productCode?: string;

  @ApiPropertyOptional()
  @Expose()
  productVersion?: number;

  @ApiPropertyOptional()
  @Expose()
  orderId?: string;

  @ApiProperty()
  @Expose()
  provisioningKey: string;

  @ApiPropertyOptional()
  @Expose()
  revokedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  revokeReason?: string;

  @ApiPropertyOptional()
  @Expose()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<EntitlementResponseDto>) {
    Object.assign(this, partial);
  }
}
