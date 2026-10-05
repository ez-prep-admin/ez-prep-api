import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { EntitlementApiResponseDto } from './dto/entitlement-api-response.dto';
import { GrantEntitlementDto } from './dto/grant-entitlement.dto';
import { RevokeEntitlementDto } from './dto/revoke-entitlement.dto';
import { EntitlementsService } from './entitlements.service';

@ApiTags('admin-entitlements')
@Controller('admin/entitlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminEntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Post('grant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant entitlement to a user (Admin)',
    description:
      'Creates an ADMIN_GRANT entitlement. durationPreset is converted to expiresAt server-side. ' +
      'User.subscription is not used for access (entitlements are SoT).',
  })
  @ApiOkResponse({ type: EntitlementApiResponseDto })
  async grant(
    @Body() dto: GrantEntitlementDto,
    @GetUser() admin: UserResponseDto,
  ): Promise<EntitlementApiResponseDto> {
    const data = await this.entitlementsService.grant(dto, {
      actorUserId: admin.id,
    });
    return {
      message: 'Entitlement granted successfully',
      data,
    };
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an entitlement (Admin)' })
  @ApiParam({ name: 'id', description: 'Entitlement id' })
  @ApiOkResponse({ type: EntitlementApiResponseDto })
  @ApiNotFoundResponse({ description: 'Entitlement not found' })
  async revoke(
    @Param('id') id: string,
    @Body() dto: RevokeEntitlementDto,
    @GetUser() admin: UserResponseDto,
  ): Promise<EntitlementApiResponseDto> {
    const data = await this.entitlementsService.revoke(
      id,
      admin.id,
      dto.reason,
    );
    return {
      message: 'Entitlement revoked successfully',
      data,
    };
  }
}
