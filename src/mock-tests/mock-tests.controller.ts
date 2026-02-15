import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { MockTestsService } from './mock-tests.service';
import { MockTestResponseDto } from './dto/mock-test-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('mock-tests')
@Controller('mock-tests')
@UseGuards(JwtAuthGuard) // All routes require authentication
@ApiBearerAuth('JWT-auth')
export class MockTestsController {
  constructor(private readonly mockTestsService: MockTestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all mock tests with pagination and search',
    description: `
    Retrieves a paginated list of mock tests. Supports:
    - Pagination with configurable page size
    - Search by title or description
    - Sorted by newest first
    
    All query parameters are optional. Default: page=1, limit=10
    `,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (minimum: 1, maximum: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term to filter by title or description',
    example: 'NEET',
  })
  @ApiResponse({
    status: 200,
    description: 'Mock tests retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Mock tests retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/MockTestResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 45 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<{
    message: string;
    data: MockTestResponseDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findAll(page, limit, search);
    return {
      message: search
        ? `Mock tests matching "${search}" retrieved successfully`
        : 'Mock tests retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get mock test statistics (Admin only)',
    description: `
    Retrieves comprehensive statistics about mock tests including:
    - Total and active tests
    - Distribution by generation mode (STATIC/DYNAMIC)
    - Distribution by difficulty level
    
    Requires admin privileges.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Mock test statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            totalTests: { type: 'number', example: 45 },
            activeTests: { type: 'number', example: 40 },
            inactiveTests: { type: 'number', example: 5 },
            byGenerationMode: {
              type: 'object',
              properties: {
                static: { type: 'number', example: 35 },
                dynamic: { type: 'number', example: 10 },
              },
            },
            byDifficulty: {
              type: 'object',
              properties: {
                easy: { type: 'number', example: 10 },
                medium: { type: 'number', example: 20 },
                hard: { type: 'number', example: 10 },
                unspecified: { type: 'number', example: 5 },
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async getStats(): Promise<{
    message: string;
    data: any;
  }> {
    const stats = await this.mockTestsService.getStats();
    return {
      message: 'Mock test statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active mock tests only',
    description: `
    Retrieves only active mock tests with pagination.
    Sorted by newest first.
    `,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (minimum: 1, maximum: 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Active mock tests retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findActive(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: MockTestResponseDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findActive(page, limit);
    return {
      message: 'Active mock tests retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('difficulty/:level')
  @ApiOperation({
    summary: 'Get mock tests by difficulty level',
    description: `
    Retrieves mock tests filtered by difficulty level with pagination.
    Valid difficulty levels: easy, medium, hard
    `,
  })
  @ApiParam({
    name: 'level',
    enum: ['easy', 'medium', 'hard'],
    description: 'Difficulty level',
    example: 'medium',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (minimum: 1, maximum: 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Mock tests retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findByDifficulty(
    @Param('level') level: 'easy' | 'medium' | 'hard',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: MockTestResponseDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findByDifficulty(
      level,
      page,
      limit,
    );
    return {
      message: `${level.charAt(0).toUpperCase() + level.slice(1)} difficulty mock tests retrieved successfully`,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single mock test by ID',
    description: `
    Retrieves detailed information about a specific mock test.
    Returns 404 if the mock test doesn't exist or has been soft-deleted.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Mock test ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Mock test retrieved successfully',
    type: MockTestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Mock test not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: MockTestResponseDto;
  }> {
    const mockTest = await this.mockTestsService.findOne(id);
    return {
      message: 'Mock test retrieved successfully',
      data: mockTest,
    };
  }
}
