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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferApiResponseDto } from './dto/offer-response.dto';
import { OffersService } from './offers.service';

@ApiTags('admin-offers')
@Controller('admin/products/:productId/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminProductOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create offer for a product (Admin)',
    description:
      'Amounts are integer paise (GST-inclusive). At most one ACTIVE offer per product+duration.',
  })
  @ApiParam({ name: 'productId' })
  @ApiOkResponse({ type: OfferApiResponseDto })
  async create(
    @Param('productId') productId: string,
    @Body() dto: CreateOfferDto,
  ): Promise<OfferApiResponseDto> {
    const data = await this.offersService.create(productId, dto);
    return { message: 'Offer created successfully', data };
  }
}
