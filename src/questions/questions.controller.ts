import {
  Body,
  Controller,
  DefaultValuePipe,
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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionResponseDto } from './dto/question-response.dto';

@ApiTags('questions')
@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Admin privileges required' })
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a question (Admin only)' })
  @ApiResponse({ status: 201, type: QuestionResponseDto })
  async create(@Body() dto: CreateQuestionDto): Promise<{
    message: string;
    data: QuestionResponseDto;
  }> {
    const question = await this.questionsService.create(dto);
    return {
      message: 'Question created successfully',
      data: question,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List questions (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'subjectId', required: false, type: String })
  @ApiQuery({ name: 'topicId', required: false, type: String })
  @ApiQuery({ name: 'examId', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('examId') examId?: string,
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
    );
    return {
      message: 'Questions retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a question including answer key (Admin only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: QuestionResponseDto })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: QuestionResponseDto;
  }> {
    const question = await this.questionsService.findOne(id);
    return {
      message: 'Question retrieved successfully',
      data: question,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a question (Admin only)' })
  @ApiParam({ name: 'id' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<{
    message: string;
    data: QuestionResponseDto;
  }> {
    const question = await this.questionsService.update(id, dto);
    return {
      message: 'Question updated successfully',
      data: question,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a question (Admin only)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.questionsService.remove(id);
  }
}
