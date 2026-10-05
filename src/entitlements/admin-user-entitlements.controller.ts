import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { EntitlementListApiResponseDto } from './dto/entitlement-api-response.dto';
import { EntitlementsService } from './entitlements.service';

/**
 * Nested under admin/users to match api-contracts GET /admin/users/:userId/entitlements.
 * AdminUsersController owns other admin/users routes.
 */
@ApiTags('admin-entitlements')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminUserEntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get(':userId/entitlements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List entitlements for a user (Admin)',
  })
  @ApiParam({ name: 'userId', description: 'Target user id' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
  })
  @ApiOkResponse({ type: EntitlementListApiResponseDto })
  async listForUser(
    @Param('userId') userId: string,
    @Query('includeInactive', new DefaultValuePipe(true), ParseBoolPipe)
    includeInactive: boolean,
  ): Promise<EntitlementListApiResponseDto> {
    // Admin list defaults to include inactive for support visibility.
    const data = await this.entitlementsService.listByUser(userId, {
      includeInactive,
    });
    return {
      message: 'Entitlements retrieved successfully',
      data,
    };
  }
}
