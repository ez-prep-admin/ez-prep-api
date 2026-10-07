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
  constructor(private readonly catalogService: CatalogService) {}

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
  ) {
    const result = await this.catalogService.listProducts({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
    return {
      message: 'Catalog products retrieved successfully',
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
  ): Promise<CatalogProductsListApiResponseDto> {
    const data = await this.catalogService.forExam(examId);
    return {
      message: 'Covering products retrieved successfully',
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
  ): Promise<CatalogProductsListApiResponseDto> {
    const data = await this.catalogService.forMockTest(mockTestId);
    return {
      message: 'Covering products retrieved successfully',
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
  async getOne(@Param('id') id: string): Promise<CatalogProductApiResponseDto> {
    const data = await this.catalogService.getProduct(id);
    return { message: 'Catalog product retrieved successfully', data };
  }
}
