import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CommerceAuditService } from './commerce-audit.service';

@ApiTags('admin-commerce-audit')
@Controller('admin/commerce-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminCommerceAuditController {
  constructor(private readonly commerceAuditService: CommerceAuditService) {}

  @Get()
  @ApiOperation({ summary: 'List commerce audit logs (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiOkResponse({ description: 'Commerce audit logs' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    const result = await this.commerceAuditService.list({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
      resourceType,
    });
    return {
      message: 'Commerce audit logs retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
