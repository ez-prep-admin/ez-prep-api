import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new category (Admin only)',
    description:
      'Creates a new exam category like Banking, SSC, Railways, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Category already exists' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<{
    message: string;
    data: CategoryResponseDto;
  }> {
    const category = await this.categoriesService.create(createCategoryDto);
    return {
      message: 'Category created successfully',
      data: category,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories with pagination',
    description:
      'Retrieves all categories with optional search and filtering. Public endpoint.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or short name',
    example: 'Banking',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Show only active categories',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    type: [CategoryResponseDto],
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe)
    activeOnly?: boolean,
  ): Promise<{
    message: string;
    data: CategoryResponseDto[];
    pagination: any;
  }> {
    const result = await this.categoriesService.findAll(
      page,
      limit,
      search,
      activeOnly,
    );
    return {
      message: search
        ? `Categories matching "${search}" retrieved successfully`
        : 'Categories retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get all active categories',
    description:
      'Retrieves all active categories without pagination. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active categories retrieved successfully',
    type: [CategoryResponseDto],
  })
  async findActiveCategories(): Promise<{
    message: string;
    data: CategoryResponseDto[];
    count: number;
  }> {
    const categories = await this.categoriesService.findActiveCategories();
    return {
      message: 'Active categories retrieved successfully',
      data: categories,
      count: categories.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get category by ID',
    description: 'Retrieves a single category by its ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category retrieved successfully',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Category not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: CategoryResponseDto;
  }> {
    const category = await this.categoriesService.findOne(id);
    return {
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update category (Admin only)',
    description: 'Updates an existing category',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Name/ShortName already exists' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<{
    message: string;
    data: CategoryResponseDto;
  }> {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    return {
      message: 'Category updated successfully',
      data: category,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete category (Admin only)',
    description: 'Soft deletes a category',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: CategoryResponseDto;
  }> {
    const category = await this.categoriesService.remove(id);
    return {
      message: 'Category deleted successfully',
      data: category,
    };
  }
}
