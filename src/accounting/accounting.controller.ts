import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
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
import { AccountingService } from './accounting.service';
import { AccountingOverviewDto } from './dto/accounting-overview.dto';

@ApiTags('admin-accounting')
@Controller('admin/accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accounting overview (Admin)',
    description:
      'Cached commerce snapshot. Figures refresh at most once per hour.',
  })
  @ApiOkResponse({ type: AccountingOverviewDto })
  async overview(): Promise<{ message: string; data: AccountingOverviewDto }> {
    const data = await this.accounting.getOverview();
    return {
      message: 'Accounting overview retrieved successfully',
      data,
    };
  }
}
