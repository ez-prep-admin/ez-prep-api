import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { SubjectForExamResponseDto } from './dto/subject-for-exam-response.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new subject (Admin only)',
    description:
      'Creates a new subject like Quantitative Aptitude, General Knowledge, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Subject created successfully',
    type: SubjectResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Subject already exists' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async create(@Body() createSubjectDto: CreateSubjectDto): Promise<{
    message: string;
    data: SubjectResponseDto;
  }> {
    const subject = await this.subjectsService.create(createSubjectDto);
    return {
      message: 'Subject created successfully',
      data: subject,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all subjects with pagination',
    description:
      'Retrieves a paginated list of subjects with populated topics. Public endpoint. Defaults: page=1, limit=10',
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
    description: 'Subjects retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Subjects retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/SubjectResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 3 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: SubjectResponseDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.subjectsService.findAll(page, limit);
    return {
      message: 'Subjects retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('exam/:examId')
  @ApiOperation({
    summary: 'Get subjects by exam',
    description:
      'Retrieves all subjects associated with a specific exam. Useful for populating subject filter dropdowns.',
  })
  @ApiParam({
    name: 'examId',
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Subjects for exam retrieved successfully',
    type: [SubjectForExamResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Exam not found' })
  async findByExam(@Param('examId') examId: string): Promise<{
    message: string;
    data: SubjectForExamResponseDto[];
  }> {
    const subjects = await this.subjectsService.findByExam(examId);
    return {
      message: 'Subjects for exam retrieved successfully',
      data: subjects,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get subject by ID',
    description:
      'Retrieves a single subject with populated topics. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Subject ID' })
  @ApiResponse({
    status: 200,
    description: 'Subject retrieved successfully',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Subject not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: SubjectResponseDto;
  }> {
    const subject = await this.subjectsService.findOne(id);
    return {
      message: 'Subject retrieved successfully',
      data: subject,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update subject (Admin only)',
    description: 'Updates an existing subject',
  })
  @ApiParam({ name: 'id', description: 'Subject ID' })
  @ApiResponse({
    status: 200,
    description: 'Subject updated successfully',
    type: SubjectResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Subject name already exists' })
  @ApiNotFoundResponse({ description: 'Subject not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async update(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
  ): Promise<{
    message: string;
    data: SubjectResponseDto;
  }> {
    const subject = await this.subjectsService.update(id, updateSubjectDto);
    return {
      message: 'Subject updated successfully',
      data: subject,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete subject (Admin only)',
    description: 'Soft deletes a subject',
  })
  @ApiParam({ name: 'id', description: 'Subject ID' })
  @ApiResponse({
    status: 200,
    description: 'Subject deleted successfully',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Subject not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: SubjectResponseDto;
  }> {
    const subject = await this.subjectsService.remove(id);
    return {
      message: 'Subject deleted successfully',
      data: subject,
    };
  }
}
