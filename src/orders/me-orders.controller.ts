import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('me-orders')
@Controller('me/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class MeOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List my orders',
    description:
      'Newest first. Amounts are integer paise. Pending and failed orders are included.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Own orders' })
  async listMine(
    @GetUser() user: UserResponseDto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.ordersService.listForUser(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      message: 'Orders retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get my order' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getMine(@GetUser() user: UserResponseDto, @Param('id') id: string) {
    const data = await this.ordersService.getForUser(user.id, id);
    return {
      message: 'Order retrieved successfully',
      data,
    };
  }
}
