import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AccessDecisionReason } from '../../common/enums/access-decision-reason.enum';
import { AccessDto } from '../to-access-dto';

/** Embedded on student paper list/get responses (api-contracts §1 / §11). */
export class AccessResponseDto implements AccessDto {
  @ApiProperty({
    description: 'Whether the authenticated user may start this paper',
    example: true,
  })
  @Expose()
  allowed: boolean;

  @ApiProperty({
    description: 'Machine-readable access reason',
    enum: AccessDecisionReason,
    example: AccessDecisionReason.ALLOWED,
  })
  @Expose()
  reason: string;
}
