import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
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
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AdminQuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionResponseDto } from './dto/question-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('admin-questions')
@Controller('admin/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminQuestionsController {
  constructor(private readonly questionsService: AdminQuestionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new question (Admin only)',
    description:
      'Creates a new question with bilingual support, exactly 4 options, and optional taxonomy references.',
  })
  @ApiResponse({
    status: 201,
    description: 'Question created successfully',
    type: QuestionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or referenced entity not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async create(
    @Body() createQuestionDto: CreateQuestionDto,
  ): Promise<{ message: string; data: QuestionResponseDto }> {
    const question = await this.questionsService.create(createQuestionDto);
    return {
      message: 'Question created successfully',
      data: question,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List questions with pagination (Admin only)',
    description:
      'Retrieves a paginated list of questions with optional filters.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'subjectId', required: false, type: String })
  @ApiQuery({ name: 'topicId', required: false, type: String })
  @ApiQuery({ name: 'examId', required: false, type: String })
  @ApiQuery({
    name: 'difficultyLevel',
    required: false,
    enum: ['easy', 'medium', 'hard'],
  })
  @ApiQuery({ name: 'tagId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Questions retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('examId') examId?: string,
    @Query('difficultyLevel') difficultyLevel?: string,
    @Query('tagId') tagId?: string,
  ): Promise<{
    message: string;
    data: QuestionResponseDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.questionsService.findAll(
      page,
      limit,
      subjectId,
      topicId,
      examId,
      difficultyLevel,
      tagId,
    );
    return {
      message: 'Questions retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a question by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Question ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Question retrieved successfully',
    type: QuestionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Question not found' })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<{ message: string; data: QuestionResponseDto }> {
    const question = await this.questionsService.findOne(id);
    return {
      message: 'Question retrieved successfully',
      data: question,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a question (Admin only)',
    description:
      'Replaces question content. Requires exactly 4 options and a valid correct answer.',
  })
  @ApiParam({
    name: 'id',
    description: 'Question ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Question updated successfully',
    type: QuestionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or referenced entity not found',
  })
  @ApiNotFoundResponse({ description: 'Question not found' })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ): Promise<{ message: string; data: QuestionResponseDto }> {
    const question = await this.questionsService.update(id, updateQuestionDto);
    return {
      message: 'Question updated successfully',
      data: question,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a question (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Question ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({ status: 200, description: 'Question deleted successfully' })
  @ApiNotFoundResponse({ description: 'Question not found' })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.questionsService.remove(id);
  }
}
