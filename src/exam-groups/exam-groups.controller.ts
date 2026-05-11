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
import { ExamGroupsService } from './exam-groups.service';
import { CreateExamGroupDto } from './dto/create-exam-group.dto';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto';
import { ExamGroupResponseDto } from './dto/exam-group-response.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('exam-groups')
@Controller('exam-groups')
export class ExamGroupsController {
  constructor(private readonly examGroupsService: ExamGroupsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new exam group (Admin only)',
    description: 'Creates a new exam group like UPSC CSE, JEE Advanced, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Exam group created successfully',
    type: ExamGroupResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Exam group already exists' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async create(@Body() createExamGroupDto: CreateExamGroupDto): Promise<{
    message: string;
    data: ExamGroupResponseDto;
  }> {
    const examGroup = await this.examGroupsService.create(createExamGroupDto);
    return {
      message: 'Exam group created successfully',
      data: examGroup,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all exam groups with pagination',
    description:
      'Retrieves all exam groups with optional search and filtering. Public endpoint.',
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
    example: 'UPSC',
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
    description: 'Show only active exam groups',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Exam groups retrieved successfully',
    type: [ExamGroupResponseDto],
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
    data: ExamGroupResponseDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.examGroupsService.findAll(
      page,
      limit,
      search,
      categoryId,
      activeOnly,
    );
    return {
      message: search
        ? `Exam groups matching "${search}" retrieved successfully`
        : 'Exam groups retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get all active exam groups',
    description:
      'Retrieves all active exam groups without pagination. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active exam groups retrieved successfully',
    type: [ExamGroupResponseDto],
  })
  async findActiveExamGroups(): Promise<{
    message: string;
    data: ExamGroupResponseDto[];
    count: number;
  }> {
    const examGroups = await this.examGroupsService.findActiveExamGroups();
    return {
      message: 'Active exam groups retrieved successfully',
      data: examGroups,
      count: examGroups.length,
    };
  }

  @Get('by-category/:categoryId')
  @ApiOperation({
    summary: 'Get exam groups by category',
    description:
      'Retrieves all active exam groups for a specific category. Public endpoint.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam groups retrieved successfully',
    type: [ExamGroupResponseDto],
  })
  async findByCategory(@Param('categoryId') categoryId: string): Promise<{
    message: string;
    data: ExamGroupResponseDto[];
    count: number;
  }> {
    const examGroups = await this.examGroupsService.findByCategory(categoryId);
    return {
      message: 'Exam groups retrieved successfully',
      data: examGroups,
      count: examGroups.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get exam group by ID',
    description: 'Retrieves a single exam group by its ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Exam group ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam group retrieved successfully',
    type: ExamGroupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Exam group not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: ExamGroupResponseDto;
  }> {
    const examGroup = await this.examGroupsService.findOne(id);
    return {
      message: 'Exam group retrieved successfully',
      data: examGroup,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update exam group (Admin only)',
    description: 'Updates an existing exam group',
  })
  @ApiParam({ name: 'id', description: 'Exam group ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam group updated successfully',
    type: ExamGroupResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Name already exists' })
  @ApiNotFoundResponse({ description: 'Exam group not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async update(
    @Param('id') id: string,
    @Body() updateExamGroupDto: UpdateExamGroupDto,
  ): Promise<{
    message: string;
    data: ExamGroupResponseDto;
  }> {
    const examGroup = await this.examGroupsService.update(
      id,
      updateExamGroupDto,
    );
    return {
      message: 'Exam group updated successfully',
      data: examGroup,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete exam group (Admin only)',
    description: 'Soft deletes an exam group',
  })
  @ApiParam({ name: 'id', description: 'Exam group ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam group deleted successfully',
    type: ExamGroupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Exam group not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: ExamGroupResponseDto;
  }> {
    const examGroup = await this.examGroupsService.remove(id);
    return {
      message: 'Exam group deleted successfully',
      data: examGroup,
    };
  }
}
