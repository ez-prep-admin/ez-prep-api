import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutBillingDto } from '../orders/dto/create-checkout-order.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('me-billing-profile')
@Controller('me/billing-profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class MeBillingProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my saved checkout billing profile',
    description:
      'Returns null until the user has saved a billing name, state, and address.',
  })
  @ApiOkResponse({ description: 'Saved profile, or null' })
  async getMine(@GetUser() user: UserResponseDto) {
    const data = await this.usersService.getBillingProfile(user.id);
    return {
      message: 'Billing profile retrieved successfully',
      data,
    };
  }

  @Patch()
  @ApiOperation({
    summary: 'Save my checkout billing profile',
    description:
      'Same fields as checkout billing. Unknown state codes are rejected.',
  })
  @ApiOkResponse({ description: 'Saved profile' })
  async updateMine(
    @GetUser() user: UserResponseDto,
    @Body() dto: CheckoutBillingDto,
  ) {
    const data = await this.usersService.updateBillingProfile(user.id, dto);
    return {
      message: 'Billing profile updated successfully',
      data,
    };
  }
}
