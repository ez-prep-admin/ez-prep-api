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
When \`questionIds\` is omitted, samples the most recent active questions tagged to the exam (\`createdAt\` descending, \`_id\` as the tie-break).
When \`questionIds\` is set, those questions are frozen in that order. The array length must equal \`totalQuestions\` (10, 15, 20, 25, or 30). Each question must be active, have a difficulty, have a subject, and be tagged to \`examId\`.
No subject, topic, or difficulty quota. The result is a draft in \`sprinttestdrafts\` with status \`REVIEW\`. Nothing is written to \`mocktests\` until publish.
Correct answers and explanations are not returned.

Error codes (400): \`BANK_SHORTAGE\` (sampled path), \`QUESTION_COUNT_MISMATCH\`, \`DUPLICATE_QUESTION\`, \`QUESTION_NOT_ELIGIBLE\`, \`EXAM_MISMATCH\`. 404: \`EXAM_NOT_FOUND\`.
    `,
  })
  @ApiCreatedResponse({ type: SprintDraftResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid size or duration, not enough eligible questions, or hand-picked questions are ineligible',
  })
  @ApiNotFoundResponse({ description: 'Exam not found or inactive' })
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
  @ApiOperation({
    summary: 'List open sprint drafts (Admin)',
    description:
      'Drafts still in REVIEW, GENERATING, or PUBLISHING. Discarded and published drafts are excluded.',
  })
  @ApiQuery({
    name: 'examId',
    required: false,
    description: 'When set, only drafts for this exam',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '1–100, default 10',
    example: 10,
  })
  @ApiOkResponse({ type: SprintDraftListItemDto, isArray: true })
  @ApiBadRequestResponse({ description: 'examId is not a valid id' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
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
Same guards as full-mock replacement search.
\`subjectId\` is required unless \`allowCrossSubject=true\` (and then \`draftId\` is required).
\`draftId\` limits results to questions tagged to that draft's exam and excludes ids already on the paper.
Results are paginated (default 20, max 50) and ordered by \`updatedAt\` descending, then \`createdAt\`.
Correct answers and explanations are not returned.
    `,
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    description: 'Required unless allowCrossSubject is true',
  })
  @ApiQuery({
    name: 'draftId',
    required: false,
    description:
      'Scopes the bank to this draft exam and excludes questions already on the paper. Required when allowCrossSubject is true.',
  })
  @ApiQuery({ name: 'allowCrossSubject', required: false, type: Boolean })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive match on English or Malayalam question text',
  })
  @ApiQuery({ name: 'topicId', required: false })
  @ApiQuery({
    name: 'difficultyLevel',
    required: false,
    enum: ['easy', 'medium', 'hard'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '1–50, default 20',
    example: 20,
  })
  @ApiOkResponse({ type: SprintSearchQuestionItemDto, isArray: true })
  @ApiBadRequestResponse({
    description:
      'Missing subjectId, allowCrossSubject without draftId, or an invalid id',
  })
  @ApiForbiddenResponse({ description: 'Admin role required' })
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
  @ApiOperation({
    summary: 'Get a sprint draft for review (Admin)',
    description:
      'Questions are grouped by slot subject. Positions stay 0-based across the paper. Keys and explanations are omitted. Discarded drafts return 404.',
  })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiOkResponse({ type: SprintDraftResponseDto })
  @ApiNotFoundResponse({ description: 'Draft not found or discarded' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
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
\`DUPLICATE_QUESTION\`, \`QUESTION_NOT_ELIGIBLE\`. \`allowCrossSubject\` allows a question whose subject
is not the slot subject and is not one of the exam blueprint subjects. The question must still be
tagged to this exam. The slot keeps its subject, marks, negative marking, and position.
Usage counts are not incremented.
    `,
  })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiParam({
    name: 'position',
    description: '0-based index across the whole paper',
    example: 0,
  })
  @ApiOkResponse({ type: SprintDraftResponseDto })
  @ApiBadRequestResponse({
    description:
      'Draft not editable, subject mismatch, exam mismatch, duplicate, or ineligible question',
  })
  @ApiNotFoundResponse({ description: 'Draft not found' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
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
Writes \`paperType: SPRINT\` into \`mocktests\`. One timer, no \`subjectConfig\`, and \`isSessionWise\` is false.
Does not increment \`fullMockUsageCount\`. Question count and duration stay as drafted.
The draft must be \`REVIEW\`. On failure the draft returns to \`REVIEW\`.

Students then see it on \`GET /sprint-tests\` and take it with \`POST /mock-test-attempts/start\` and \`POST .../submit\`.
    `,
  })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiOkResponse({ type: PublishSprintDraftResultDto })
  @ApiBadRequestResponse({
    description:
      'Draft not editable, duplicate questions, or a question is no longer eligible',
  })
  @ApiNotFoundResponse({ description: 'Draft not found' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
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
  @ApiOperation({
    summary: 'Discard a sprint draft (Admin)',
    description:
      'Sets status to DISCARDED. Does not change question usage. Published drafts cannot be discarded.',
  })
  @ApiParam({ name: 'id', description: 'Draft ID' })
  @ApiOkResponse({ description: 'Draft discarded' })
  @ApiBadRequestResponse({
    description: 'Published drafts cannot be discarded',
  })
  @ApiNotFoundResponse({ description: 'Draft not found' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async discardDraft(@Param('id') id: string): Promise<{ message: string }> {
    await this.sprintTestsService.discardDraft(id);
    return { message: 'Draft discarded successfully' };
  }

  @Get()
  @ApiOperation({
    summary: 'List published sprint tests',
    description:
      'Students see active papers. Admins also see inactive ones. Each row includes userAttemptAction (START, RESUME, or RETAKE). Take the test with POST /mock-test-attempts/start, or resume when the action is RESUME. Sprint papers use one timer and POST .../submit. Topic-wise and full-exam papers are not included.',
  })
  @ApiQuery({
    name: 'examId',
    required: false,
    description: 'When set, only sprint papers for this exam',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '1–100, default 10',
    example: 10,
  })
  @ApiOkResponse({ type: SprintTestListItemDto, isArray: true })
  @ApiBadRequestResponse({ description: 'examId is not a valid id' })
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
      '404 if the id is topic-wise, a full exam, or deleted. Includes userAttemptAction. Admins also receive safe question stems in paper order (no correctAnswer or explanation). Students start or resume an attempt to receive the paper.',
  })
  @ApiParam({ name: 'id', description: 'Published sprint test ID' })
  @ApiOkResponse({ type: SprintTestListItemDto })
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
  @ApiOperation({
    summary: 'Soft delete a published sprint test (Admin)',
    description:
      'Sets isDeleted and isActive false. Topic-wise and full-exam ids return 404.',
  })
  @ApiParam({ name: 'id', description: 'Published sprint test ID' })
  @ApiOkResponse({ description: 'Sprint test deleted' })
  @ApiNotFoundResponse({ description: 'Not a published sprint paper' })
  @ApiBadRequestResponse({ description: 'Invalid ID' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.sprintTestsService.removePublished(id);
  }
}
