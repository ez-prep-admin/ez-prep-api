import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';

export class ProductGrantDto {
  @ApiProperty({ enum: EntitlementScopeType })
  @IsEnum(EntitlementScopeType)
  scopeType: EntitlementScopeType;

  @ApiProperty({ example: '64f123456789abcdef123456' })
  @IsMongoId()
  scopeId: string;
}
