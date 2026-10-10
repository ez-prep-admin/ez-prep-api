import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CommerceHealthService } from './commerce-health.service';

@ApiTags('admin-commerce')
@Controller('admin/commerce')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class CommerceHealthController {
  constructor(private readonly health: CommerceHealthService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Commerce health (Admin)',
    description:
      'Read model for stuck payments, refunds, invoices, and webhook delivery. Not gated by COMMERCE_ENABLED.',
  })
  @ApiOkResponse({ description: 'Health snapshot' })
  async healthReport() {
    const data = await this.health.snapshot();
    return {
      message: 'Commerce health retrieved successfully',
      data,
    };
  }
}
