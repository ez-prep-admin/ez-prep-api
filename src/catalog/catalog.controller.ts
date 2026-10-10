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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CatalogService } from './catalog.service';
import {
  CatalogProductApiResponseDto,
  CatalogProductsListApiResponseDto,
} from './dto/catalog-product-response.dto';

@ApiTags('catalog')
@Controller('catalog/products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly commerceConfig: CommerceConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List PUBLISHED catalog products',
    description:
      'Money fields on offers are integer paise (GST-inclusive). Frontends convert to ₹ for display.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @GetUser() user?: UserResponseDto,
  ) {
    const result = await this.catalogService.listProducts(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        search,
      },
      user?.id,
    );
    return {
      message: 'Catalog products retrieved successfully',
      commerceEnabled: this.commerceConfig.settings.commerceEnabled,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('for-exam/:examId')
  @ApiOperation({
    summary: 'Covering products for an exam (View plans)',
    description: 'Matches EXAM and EXAM_GROUP grants only.',
  })
  @ApiParam({ name: 'examId' })
  @ApiOkResponse({ type: CatalogProductsListApiResponseDto })
  @ApiNotFoundResponse()
  async forExam(
    @Param('examId') examId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<CatalogProductsListApiResponseDto> {
    const data = await this.catalogService.forExam(examId, user.id);
    return {
      message: 'Covering products retrieved successfully',
      commerceEnabled: this.commerceConfig.settings.commerceEnabled,
      data,
    };
  }

  @Get('for-mock-test/:mockTestId')
  @ApiOperation({
    summary: 'Covering products for a mock test paper (View plans)',
    description: 'Matches MOCK_TEST, EXAM, and EXAM_GROUP grants.',
  })
  @ApiParam({ name: 'mockTestId' })
  @ApiOkResponse({ type: CatalogProductsListApiResponseDto })
  @ApiNotFoundResponse()
  async forMockTest(
    @Param('mockTestId') mockTestId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<CatalogProductsListApiResponseDto> {
    const data = await this.catalogService.forMockTest(mockTestId, user.id);
    return {
      message: 'Covering products retrieved successfully',
      commerceEnabled: this.commerceConfig.settings.commerceEnabled,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Catalog product detail with ACTIVE offers',
    description:
      'effectiveAmount on each offer is integer paise at request time.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: CatalogProductApiResponseDto })
  @ApiNotFoundResponse()
  async getOne(
    @Param('id') id: string,
    @GetUser() user: UserResponseDto,
  ): Promise<CatalogProductApiResponseDto> {
    const data = await this.catalogService.getProduct(id, user.id);
    return {
      message: 'Catalog product retrieved successfully',
      commerceEnabled: this.commerceConfig.settings.commerceEnabled,
      data,
    };
  }
}
