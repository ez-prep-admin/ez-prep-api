import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ProductStatus } from '../common/enums/product-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { DuplicateProductDto } from './dto/duplicate-product.dto';
import { OffersService } from '../offers/offers.service';
import {
  ProductApiResponseDto,
  ProductDetailResponseDto,
  ProductVersionApiResponseDto,
  ProductVersionsApiResponseDto,
} from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('admin-products')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly offersService: OffersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List products (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ProductStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ProductStatus,
    @Query('search') search?: string,
  ) {
    const result = await this.productsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
    return {
      message: 'Products retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create DRAFT product (Admin)' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  async create(
    @Body() dto: CreateProductDto,
    @GetUser() admin: UserResponseDto,
  ): Promise<ProductApiResponseDto> {
    const data = await this.productsService.create(dto, admin.id);
    return { message: 'Product created successfully', data };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List immutable product versions (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductVersionsApiResponseDto })
  async listVersions(
    @Param('id') id: string,
  ): Promise<ProductVersionsApiResponseDto> {
    const data = await this.productsService.listVersions(id);
    return { message: 'Product versions retrieved successfully', data };
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get a single product version (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'version' })
  @ApiOkResponse({ type: ProductVersionApiResponseDto })
  @ApiNotFoundResponse()
  async getVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<ProductVersionApiResponseDto> {
    const data = await this.productsService.getVersion(id, version);
    return { message: 'Product version retrieved successfully', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product detail + offers (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  @ApiNotFoundResponse()
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: ProductDetailResponseDto;
  }> {
    const product = await this.productsService.findOne(id);
    const offers = await this.offersService.listByProduct(id);
    const data: ProductDetailResponseDto = { ...product, offers };
    return { message: 'Product retrieved successfully', data };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update product draft / published metadata (Admin)',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @GetUser() admin: UserResponseDto,
  ): Promise<ProductApiResponseDto> {
    const data = await this.productsService.update(id, dto, admin.id);
    return { message: 'Product updated successfully', data };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish product (Admin)',
    description:
      'Validates grants, bumps version on material change, writes immutable product_versions row.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  async publish(
    @Param('id') id: string,
    @GetUser() admin: UserResponseDto,
  ): Promise<ProductApiResponseDto> {
    const data = await this.productsService.publish(id, admin.id);
    return { message: 'Product published successfully', data };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive published product (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  async archive(
    @Param('id') id: string,
    @GetUser() admin: UserResponseDto,
  ): Promise<ProductApiResponseDto> {
    const data = await this.productsService.archive(id, admin.id);
    return { message: 'Product archived successfully', data };
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate product to a new DRAFT (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ProductApiResponseDto })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateProductDto,
    @GetUser() admin: UserResponseDto,
  ): Promise<ProductApiResponseDto> {
    const data = await this.productsService.duplicate(id, dto, admin.id);
    return { message: 'Product duplicated successfully', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete product (Admin)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @GetUser() admin: UserResponseDto) {
    await this.productsService.softDelete(id, admin.id);
    return { message: 'Product deleted successfully', data: null };
  }
}
