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
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamResponseDto } from './dto/exam-response.dto';
import { ExamsByCategoryResponseDto } from './dto/exams-by-category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get('by-category')
  @ApiOperation({
    summary: 'Get all exams grouped by category (Public API)',
    description: `
    Retrieves all active exams grouped by their categories.
    Perfect for landing pages and exam browsing.
    
    Features:
    - All categories at root level (key = category shortName)
    - Includes all active exams per category
    - Includes mock test counts per exam
    - Returns all data (no pagination or filtering needed)
    - No authentication required
    
    Response structure: { "SSC": {...}, "RRB": {...}, ... }
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'All exams grouped by category',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '64f123...' },
          name: { type: 'string', example: 'Staff Selection Commission' },
          shortName: { type: 'string', example: 'SSC' },
          imageUrl: { type: 'string', example: 'https://...' },
          description: { type: 'string', example: 'Government recruitment...' },
          exams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                fullName: { type: 'string' },
                duration: { type: 'string' },
                totalQuestions: { type: 'number' },
                totalMarks: { type: 'number' },
                testsCount: { type: 'number' },
                subjectsCount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
  async getExamsByCategory(): Promise<ExamsByCategoryResponseDto> {
    return await this.examsService.getExamsByCategory();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new exam (Admin only)',
    description: 'Creates a new exam under a specific category',
  })
  @ApiResponse({
    status: 201,
    description: 'Exam created successfully',
    type: ExamResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid category' })
  @ApiConflictResponse({ description: 'Exam already exists' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async create(@Body() createExamDto: CreateExamDto): Promise<{
    message: string;
    data: ExamResponseDto;
  }> {
    const exam = await this.examsService.create(createExamDto);
    return {
      message: 'Exam created successfully',
      data: exam,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all exams with pagination',
    description: 'Retrieves all exams with optional filtering and search. Public endpoint.',
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
    description: 'Search by name or description',
    example: 'SBI',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
    example: '64f123456789abcdef123456',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Show only active exams',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Exams retrieved successfully',
    type: [ExamResponseDto],
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe)
    activeOnly?: boolean,
  ): Promise<{
    message: string;
    data: ExamResponseDto[];
    pagination: any;
  }> {
    const result = await this.examsService.findAll(
      page,
      limit,
      search,
      categoryId,
      activeOnly,
    );
    return {
      message: search
        ? `Exams matching "${search}" retrieved successfully`
        : 'Exams retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get exams by category with pagination',
    description: 'Retrieves all exams for a specific category. Public endpoint.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID',
    example: '64f123456789abcdef123456',
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
  @ApiResponse({
    status: 200,
    description: 'Exams for category retrieved successfully',
    type: [ExamResponseDto],
  })
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: ExamResponseDto[];
    pagination: any;
  }> {
    const result = await this.examsService.findByCategory(
      categoryId,
      page,
      limit,
    );
    return {
      message: 'Exams for category retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get exam by ID',
    description: 'Retrieves a single exam by its ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam retrieved successfully',
    type: ExamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Exam not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: ExamResponseDto;
  }> {
    const exam = await this.examsService.findOne(id);
    return {
      message: 'Exam retrieved successfully',
      data: exam,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update exam (Admin only)',
    description: 'Updates an existing exam',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam updated successfully',
    type: ExamResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Exam name already exists' })
  @ApiNotFoundResponse({ description: 'Exam not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async update(
    @Param('id') id: string,
    @Body() updateExamDto: UpdateExamDto,
  ): Promise<{
    message: string;
    data: ExamResponseDto;
  }> {
    const exam = await this.examsService.update(id, updateExamDto);
    return {
      message: 'Exam updated successfully',
      data: exam,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete exam (Admin only)',
    description: 'Soft deletes an exam',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam deleted successfully',
    type: ExamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Exam not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: ExamResponseDto;
  }> {
    const exam = await this.examsService.remove(id);
    return {
      message: 'Exam deleted successfully',
      data: exam,
    };
  }
}
