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
import { MockTestListItemDto } from './dto/mock-test-list-item.dto';
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
    - Total questions by difficulty level across all tests
    
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
            totalQuestionsByDifficulty: {
              type: 'object',
              properties: {
                easy: { type: 'number', example: 150 },
                medium: { type: 'number', example: 300 },
                hard: { type: 'number', example: 100 },
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

  @Get('exam/:examId')
  @ApiOperation({
    summary: 'Get mock tests by exam',
    description: `
    Retrieves mock tests filtered by exam ID with pagination.
    Useful for showing all tests for a specific exam.
    
    Returns populated exam, subject, and topic details (excludes questionIds and difficultyDistribution).
    `,
  })
  @ApiParam({
    name: 'examId',
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
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
    type: MockTestListItemDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findByExam(
    @Param('examId') examId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: MockTestListItemDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findByExam(examId, page, limit);
    return {
      message: 'Mock tests for exam retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('subject/:subjectId')
  @ApiOperation({
    summary: 'Get mock tests by subject',
    description: `
    Retrieves mock tests filtered by subject ID with pagination.
    Useful for showing all tests for a specific subject.
    `,
  })
  @ApiParam({
    name: 'subjectId',
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
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
  async findBySubject(
    @Param('subjectId') subjectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: MockTestResponseDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findBySubject(
      subjectId,
      page,
      limit,
    );
    return {
      message: 'Mock tests for subject retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('exam/:examId/subject/:subjectId')
  @ApiOperation({
    summary: 'Get mock tests by exam and subject',
    description: `
    Retrieves mock tests filtered by both exam and subject ID with pagination.
    Useful for showing subject-specific tests within an exam.
    `,
  })
  @ApiParam({
    name: 'examId',
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
  })
  @ApiParam({
    name: 'subjectId',
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
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
  async findByExamAndSubject(
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: MockTestResponseDto[];
    pagination: any;
  }> {
    const result = await this.mockTestsService.findByExamAndSubject(
      examId,
      subjectId,
      page,
      limit,
    );
    return {
      message: 'Mock tests for exam and subject retrieved successfully',
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
