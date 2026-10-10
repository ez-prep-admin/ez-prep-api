import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommerceEnabledGuard } from '../commerce/commerce-enabled.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutOrderDto } from './dto/create-checkout-order.dto';
import { CheckoutOrderApiResponseDto } from './dto/checkout-order-response.dto';
import { CheckoutThrottlerGuard } from './checkout-throttler.guard';
import { VerifyCheckoutPaymentDto } from './dto/verify-checkout-payment.dto';

@ApiTags('checkout')
@Controller('checkout/orders')
@UseGuards(CommerceEnabledGuard, JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(CheckoutThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create a checkout order',
    description:
      'Amount is computed from the offer. Client-supplied amounts are rejected. ' +
      'Replaying the same idempotencyKey returns the original order.',
  })
  @ApiOkResponse({ type: CheckoutOrderApiResponseDto })
  async create(
    @Body() dto: CreateCheckoutOrderDto,
    @GetUser() user: UserResponseDto,
  ): Promise<CheckoutOrderApiResponseDto> {
    const data = await this.checkoutService.createOrder(user.id, dto);
    return { message: 'Order created', data };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CheckoutThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify a checkout payment',
    description:
      'Validates the provider payload. A bad or missing signature does not mark the order paid.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CheckoutOrderApiResponseDto })
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyCheckoutPaymentDto,
    @GetUser() user: UserResponseDto,
  ): Promise<CheckoutOrderApiResponseDto> {
    const data = await this.checkoutService.verifyPayment(
      user.id,
      id,
      dto.providerPayload,
      dto.provider,
    );
    return { message: 'Payment verified', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the current user order' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CheckoutOrderApiResponseDto })
  async get(
    @Param('id') id: string,
    @GetUser() user: UserResponseDto,
  ): Promise<CheckoutOrderApiResponseDto> {
    const data = await this.checkoutService.getOrder(user.id, id);
    return { message: 'Order retrieved successfully', data };
  }
}
