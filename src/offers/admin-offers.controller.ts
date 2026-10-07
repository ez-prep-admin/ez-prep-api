import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { OfferApiResponseDto } from './dto/offer-response.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@ApiTags('admin-offers')
@Controller('admin/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get offer detail (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: OfferApiResponseDto })
  @ApiNotFoundResponse()
  async findOne(@Param('id') id: string): Promise<OfferApiResponseDto> {
    const data = await this.offersService.findOne(id);
    return { message: 'Offer retrieved successfully', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update offer amounts/sale/status (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: OfferApiResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<OfferApiResponseDto> {
    const data = await this.offersService.update(id, dto);
    return { message: 'Offer updated successfully', data };
  }
}
