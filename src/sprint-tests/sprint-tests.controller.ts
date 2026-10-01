import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { SprintTestsService } from './sprint-tests.service';
import { CreateSprintDraftDto } from './dto/create-sprint-draft.dto';
import { PublishSprintDraftDto } from './dto/publish-sprint-draft.dto';
import { ReplaceSprintQuestionDto } from './dto/replace-sprint-question.dto';
import {
  PublishSprintDraftResultDto,
  SprintDraftListItemDto,
  SprintDraftResponseDto,
  SprintSearchQuestionItemDto,
} from './dto/sprint-draft-response.dto';
import { SprintTestListItemDto } from './dto/sprint-test-list-item.dto';

@ApiTags('sprint-tests')
@Controller('sprint-tests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'JWT required' })
export class SprintTestsController {
  constructor(private readonly sprintTestsService: SprintTestsService) {}

  @Post('drafts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Draft a sprint test from the newest exam-tagged questions (Admin)',
    description: `
Samples the most recent active questions tagged to the exam (\`createdAt\` descending).
Size and duration must be 10, 15, 20, 25, or 30. No subject, topic, or difficulty quota.
The result is a draft. Nothing is written to \`mocktests\` until publish.

Error codes (400): \`BANK_SHORTAGE\`. 404: \`EXAM_NOT_FOUND\`.
    `,
  })
  @ApiCreatedResponse({ type: SprintDraftResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async createDraft(
    @Body() dto: CreateSprintDraftDto,
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: SprintDraftResponseDto }> {
    const draft = await this.sprintTestsService.createDraft(dto, user.id);
    return {
      message: 'Sprint draft generated successfully',
      data: draft,
    };
  }

  @Get('drafts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List open sprint drafts (Admin)' })
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: SprintDraftListItemDto, isArray: true })
  async listDrafts(
    @Query('examId') examId: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    message: string;
    data: SprintDraftListItemDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.sprintTestsService.listDrafts(
      examId,
      page,
      limit,
    );
    return {
      message: 'Drafts retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('questions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Search questions for sprint draft replacement (Admin)',
    description: `
Same contract as full-mock replacement search.
\`subjectId\` is required unless \`allowCrossSubject=true\`.
\`draftId\` scopes the bank to that draft's exam and excludes questions already on the paper.
Cross-subject replacements must still be tagged to the exam.
    `,
  })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'draftId', required: false })
  @ApiQuery({ name: 'allowCrossSubject', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'topicId', required: false })
  @ApiQuery({
    name: 'difficultyLevel',
    required: false,
    enum: ['easy', 'medium', 'hard'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchQuestions(
    @Query('subjectId') subjectId?: string,
    @Query('draftId') draftId?: string,
    @Query('search') search?: string,
    @Query('topicId') topicId?: string,
    @Query('difficultyLevel') difficultyLevel?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('allowCrossSubject', new DefaultValuePipe(false), ParseBoolPipe)
    allowCrossSubject?: boolean,
  ): Promise<{
    message: string;
    data: SprintSearchQuestionItemDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.sprintTestsService.searchQuestions({
      subjectId,
      draftId,
      search,
      topicId,
      difficultyLevel,
      page,
      limit,
      allowCrossSubject,
    });
    return {
      message: 'Questions retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('drafts/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a sprint draft for review (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: SprintDraftResponseDto })
  async getDraft(
    @Param('id') id: string,
  ): Promise<{ message: string; data: SprintDraftResponseDto }> {
    const draft = await this.sprintTestsService.getDraft(id);
    return { message: 'Draft retrieved successfully', data: draft };
  }

  @Patch('drafts/:id/questions/:position')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Replace one question in a sprint draft (Admin)',
    description: `
Guards match full mocks: \`DRAFT_NOT_EDITABLE\`, \`SUBJECT_MISMATCH\`, \`EXAM_MISMATCH\`,
\`DUPLICATE_QUESTION\`, \`QUESTION_NOT_ELIGIBLE\`. \`allowCrossSubject\` keeps the slot subject
and marks, and still requires the exam tag.
    `,
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'position' })
  async replaceQuestion(
    @Param('id') id: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: ReplaceSprintQuestionDto,
  ): Promise<{ message: string; data: SprintDraftResponseDto }> {
    const draft = await this.sprintTestsService.replaceQuestion(
      id,
      position,
      dto.questionId,
      dto.allowCrossSubject,
    );
    return { message: 'Question replaced successfully', data: draft };
  }

  @Post('drafts/:id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Publish a sprint draft (Admin)',
    description: `
Writes \`paperType: SPRINT\` into \`mocktests\`. One timer, no subject sessions.
Does not increment full-mock usage counts. Question count and duration stay as drafted.
    `,
  })
  @ApiOkResponse({ type: PublishSprintDraftResultDto })
  async publishDraft(
    @Param('id') id: string,
    @Body() dto: PublishSprintDraftDto,
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: PublishSprintDraftResultDto }> {
    const result = await this.sprintTestsService.publishDraft(id, dto, user.id);
    return {
      message: 'Sprint test published successfully',
      data: result,
    };
  }

  @Delete('drafts/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discard a sprint draft (Admin)' })
  async discardDraft(@Param('id') id: string): Promise<{ message: string }> {
    await this.sprintTestsService.discardDraft(id);
    return { message: 'Draft discarded successfully' };
  }

  @Get()
  @ApiOperation({
    summary: 'List published sprint tests',
    description:
      'Students see active papers. Admins also see inactive ones. Take the test with POST /mock-test-attempts/start. Sprint papers use one timer and POST .../submit.',
  })
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listPublished(
    @Query('examId') examId: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: SprintTestListItemDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.sprintTestsService.listPublished(
      examId,
      page,
      limit,
      user?.id,
      user?.role === UserRole.ADMIN,
    );
    return {
      message: 'Sprint tests retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one published sprint test',
    description:
      '404 if the id is topic-wise or a full exam. Admins also receive safe question stems.',
  })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Not a published sprint paper' })
  @ApiBadRequestResponse({ description: 'Invalid ID' })
  async findOne(
    @Param('id') id: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: SprintTestListItemDto }> {
    const test = await this.sprintTestsService.findOnePublished(
      id,
      user.id,
      user?.role === UserRole.ADMIN,
    );
    return { message: 'Sprint test retrieved successfully', data: test };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete a published sprint test (Admin)' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.sprintTestsService.removePublished(id);
  }
}
