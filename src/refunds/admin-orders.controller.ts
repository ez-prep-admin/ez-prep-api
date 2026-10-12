import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderStatus } from '../common/enums/order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { RepairSweepsService } from '../orders/repair-sweeps.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@ApiTags('admin-orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminOrdersController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly repairSweeps: RepairSweepsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'flag', required: false })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('flag') flag?: string,
  ) {
    const result = await this.refundsService.list({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
      flag,
    });
    return {
      message: 'Orders retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Post(':id/repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Repair a paid order (Admin)' })
  @ApiParam({ name: 'id' })
  async repair(@Param('id') id: string, @GetUser() user: UserResponseDto) {
    await this.repairSweeps.repairOrder(id, user.id);
    const data = await this.refundsService.get(id);
    return {
      message: 'Order repaired successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async get(@Param('id') id: string) {
    const data = await this.refundsService.get(id);
    return {
      message: 'Order retrieved successfully',
      data,
    };
  }

  @Post(':id/refunds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund a paid order in full (Admin)',
    description:
      'Full amount only. On provider success, revokes PAYMENT entitlements from this order. ' +
      'Does not issue a credit note or change the tax invoice.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Refund completed or pending at the provider' })
  @ApiConflictResponse({
    description:
      'Order is not paid, already refunded, or a refund is in progress',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async refund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @GetUser() admin: UserResponseDto,
  ) {
    return this.refundsService.refund(id, admin.id, dto.reason);
  }
}
