import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MockTestAttemptsService } from './mock-test-attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { StartAttemptResponseDto } from './dto/start-attempt-response.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { AttemptDetailResponseDto } from './dto/attempt-detail-response.dto';
import { ResumeAttemptResponseDto } from './dto/resume-attempt-response.dto';
import { PauseAttemptResponseDto } from './dto/pause-attempt-response.dto';
import { CompleteSessionResponseDto } from './dto/complete-session-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserAttemptSummaryDto } from './dto/user-attempt-summary.dto';

@ApiTags('mock-test-attempts')
@Controller('mock-test-attempts')
@UseGuards(JwtAuthGuard) // All routes require authentication
@ApiBearerAuth('JWT-auth')
export class MockTestAttemptsController {
  constructor(
    private readonly mockTestAttemptsService: MockTestAttemptsService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new mock test attempt',
    description: `
    Starts a new attempt for a **topic-wise or full-exam** mock test (same endpoint).

    Validations:
    - Mock test must exist and be active
    - If retakes are not allowed, user cannot have existing attempts
    - User cannot have multiple IN_PROGRESS attempts for the same test

    Creates an attempt with:
    - Frozen test configuration (marks, duration, etc.)
    - Locked question set
    - Initial state as IN_PROGRESS
    - **Full exams:** per-question marks/negative marking from each subject row
    - **Session-wise full exams:** \`sessions[]\` (with \`questionIds\` / \`questionCount\`) + \`currentSessionIndex\`
    - Questions are returned in locked paper order, grouped by session. Each question includes \`sessionOrder\`.
    - Topic-wise papers omit \`sessionOrder\` and \`sessions\`.

    Returns questions without correct answers or explanations.

    For session-wise papers, show only questions where \`sessionOrder === currentSessionIndex\`
    (or \`_id\` is in the current session's \`questionIds\`). Then call
    \`POST /mock-test-attempts/:attemptId/sessions/complete\` to unlock the next subject.
    Mixed full exams and topic-wise tests use a single paper timer and \`POST .../submit\`.
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Attempt started successfully',
    type: StartAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid mock test ID or test is not active',
  })
  @ApiNotFoundResponse({
    description: 'Mock test not found',
  })
  @ApiConflictResponse({
    description:
      'Retake not allowed or existing IN_PROGRESS attempt exists for this test',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async startAttempt(
    @Body() startAttemptDto: StartAttemptDto,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: StartAttemptResponseDto;
  }> {
    const attempt = await this.mockTestAttemptsService.startAttempt(
      startAttemptDto,
      user.id,
    );

    return {
      message: 'Mock test attempt started successfully',
      data: attempt,
    };
  }

  @Get('my-attempts')
  @ApiOperation({
    summary: 'Get all attempts for the authenticated user',
    description: `
    Retrieves all mock test attempts for the currently authenticated user.
    Results are sorted by most recent first.
    Includes basic test information (title, questions count, duration) and populated exam, subject, and topic details.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User attempts retrieved successfully',
    type: [UserAttemptSummaryDto],
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMyAttempts(@GetUser() user: UserResponseDto): Promise<{
    message: string;
    data: UserAttemptSummaryDto[];
    count: number;
  }> {
    const attempts = await this.mockTestAttemptsService.findUserAttempts(
      user.id,
    );

    return {
      message: 'Your attempts retrieved successfully',
      data: attempts,
      count: attempts.length,
    };
  }

  @Get('my-attempts/:mockTestId')
  @ApiOperation({
    summary: 'Get all attempts for a specific test by the authenticated user',
    description: `
    Retrieves all attempts for a specific mock test by the authenticated user.
    Useful to check attempt history and determine if retakes are allowed.
    Includes populated exam, subject, and topic details.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User test attempts retrieved successfully',
    type: [UserAttemptSummaryDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid mock test ID format',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMyTestAttempts(
    @Param('mockTestId') mockTestId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: UserAttemptSummaryDto[];
    count: number;
  }> {
    const attempts = await this.mockTestAttemptsService.findUserTestAttempts(
      user.id,
      mockTestId,
    );

    return {
      message: 'Your test attempts retrieved successfully',
      data: attempts,
      count: attempts.length,
    };
  }

  @Patch(':attemptId/answer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Update answer for a question in an attempt',
    description: `
    Updates the selected answer for a specific question during an active test attempt.

    Validations:
    - Attempt must exist and belong to the authenticated user
    - Attempt status must be IN_PROGRESS
    - Timer must not have expired (paper timer, or **current session** timer if session-wise)
    - Question must be part of the attempt
    - **Session-wise:** question must belong to the current session only

    If the paper (or last session) has expired, status becomes EXPIRED.
    If a mid-paper session expires, answers are rejected until
    \`POST .../sessions/complete\` is called.

    This endpoint only saves the answer. Evaluation happens during submission.
    `,
  })
  @ApiResponse({
    status: 204,
    description: 'Answer updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid IDs, attempt not IN_PROGRESS, test expired, or question not in attempt',
  })
  @ApiNotFoundResponse({
    description: 'Attempt not found or access denied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async updateAnswer(
    @Param('attemptId') attemptId: string,
    @Body() updateAnswerDto: UpdateAnswerDto,
    @GetUser() user: UserResponseDto,
  ): Promise<void> {
    await this.mockTestAttemptsService.updateAnswer(
      attemptId,
      user.id,
      updateAnswerDto,
    );
  }

  @Post(':attemptId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause an in-progress mock test attempt',
    description: `
    Pauses an active test attempt, allowing the user to resume later.

    Features:
    - Saves current progress (all selected answers are preserved)
    - Calculates and saves time consumed with 10-second grace period
    - **Session-wise:** pause applies to the **current session** timer
    - Tracks pause/resume history for auditing
    - No limit on number of pauses
    - Time remaining is preserved for resumption

    Validations:
    - Attempt must exist and belong to the authenticated user
    - Attempt status must be IN_PROGRESS
    - Current timer must not have expired

    After pausing, use GET /:attemptId/resume to continue.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt paused successfully',
    type: PauseAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid attempt ID, attempt not IN_PROGRESS, or time expired',
  })
  @ApiNotFoundResponse({
    description: 'Attempt not found or access denied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async pauseAttempt(
    @Param('attemptId') attemptId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: PauseAttemptResponseDto;
  }> {
    const result = await this.mockTestAttemptsService.pauseAttempt(
      attemptId,
      user.id,
    );

    return {
      message: 'Mock test attempt paused successfully',
      data: result,
    };
  }

  @Post(':attemptId/sessions/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete the current session (session-wise full mocks)',
    description: `
    **Session-wise full exams only.** Locks the current subject (answers kept, not scored yet)
    and unlocks the next subject. The student cannot jump ahead or go back.

    - Mid-paper: \`paperCompleted: false\` and \`nextSession\` is a resume-style payload
      (questions + timer for the new session).
    - Last session: equivalent to final submit — scores the **whole** paper using
      per-question marks. \`paperCompleted: true\` and \`results\` are set.

    If the current session timer already expired, this still advances (or submits
    on the last session). It does **not** auto-start the next session on expiry;
    the client must call this endpoint.

    Mixed full exams and topic-wise tests must use \`POST /:attemptId/submit\` instead.
    Resume first if the attempt is PAUSED.
    `,
  })
  @ApiParam({ name: 'attemptId', description: 'Attempt ID' })
  @ApiResponse({
    status: 200,
    description:
      'Session locked. nextSession present if more subjects remain; results present if the paper is finished.',
    type: CompleteSessionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Not session-wise, attempt paused/already finished, or session locked',
  })
  @ApiNotFoundResponse({ description: 'Attempt not found or access denied' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async completeSession(
    @Param('attemptId') attemptId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: CompleteSessionResponseDto;
  }> {
    const result = await this.mockTestAttemptsService.completeSession(
      attemptId,
      user.id,
    );

    return {
      message: result.paperCompleted
        ? 'Last session completed. Paper submitted.'
        : 'Session completed. Next subject is now unlocked.',
      data: result,
    };
  }

  @Post(':attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit mock test attempt and get results',
    description: `
    Submits the mock test attempt for evaluation.

    **Session-wise full exams:** only allowed on the **last** session.
    Complete earlier subjects with \`POST .../sessions/complete\`.

    Process:
    1. Validates attempt (exists, belongs to user, status = IN_PROGRESS)
    2. Server-side timer check (paper timer, or current session timer if session-wise)
    3. Optionally accepts a final answers array with 10s grace for network delay
    4. Evaluates each question:
       - Topic-wise: +attempt.marksPerQuestion / −attempt.negativeMarking
       - Full exam: +/− the marks frozen on that question from its subject row
       - Unanswered: 0
    5. Status SUBMITTED or EXPIRED; score and submittedAt stored
    6. Results: full keys if showResultsImmediately, otherwise summary only
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt submitted and evaluated successfully',
    type: SubmitAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid attempt ID or attempt not IN_PROGRESS',
  })
  @ApiNotFoundResponse({
    description: 'Attempt not found or access denied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async submitAttempt(
    @Param('attemptId') attemptId: string,
    @Body() submitAttemptDto: SubmitAttemptDto,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: SubmitAttemptResponseDto;
  }> {
    const result = await this.mockTestAttemptsService.submitAttempt(
      attemptId,
      user.id,
      submitAttemptDto,
    );

    return {
      message: result.questionResults
        ? 'Test submitted successfully. Results are available.'
        : 'Test submitted successfully. Results will be available later.',
      data: result,
    };
  }

  @Get(':attemptId/resume')
  @ApiOperation({
    summary: 'Resume attempt (Reload/Reconnection fallback)',
    description: `
    Retrieves attempt details for resuming an IN_PROGRESS or PAUSED test
    (page reload, reconnect, or after pause).

    Response includes:
    - Frozen test configuration
    - Questions with options and selected answers (no keys)
    - Time elapsed / remaining (current **session** timer if session-wise)
    - \`sessions\`, \`currentSessionIndex\`, \`isSessionWise\` for full exams

    Restrictions:
    - IN_PROGRESS or PAUSED only (PAUSED is resumed as a side effect)
    - Completed attempts: use GET /:id
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt details for resuming retrieved successfully',
    type: ResumeAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid attempt ID or attempt is not IN_PROGRESS (use GET /:id for completed attempts)',
  })
  @ApiNotFoundResponse({
    description: 'Attempt not found or access denied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async resumeAttempt(
    @Param('attemptId') attemptId: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: ResumeAttemptResponseDto;
  }> {
    const attempt = await this.mockTestAttemptsService.resumeAttempt(
      attemptId,
      user.id,
    );

    return {
      message: 'Attempt resumed successfully',
      data: attempt,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed attempt information (View results)',
    description: `
    Retrieves comprehensive details about a specific attempt (topic-wise or full exam).
    Primarily for viewing completed results. For an in-progress test use GET /:attemptId/resume.

    IN_PROGRESS / PAUSED:
    - Status, frozen config, selected answers, time remaining
    - Session-wise: \`sessions\` + \`currentSessionIndex\` (no keys)

    SUBMITTED / EXPIRED:
    - Score, correct/incorrect/unanswered, isPassed
    - Per-question keys and explanations only if showResultsImmediately
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt details retrieved successfully',
    type: AttemptDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid attempt ID format',
  })
  @ApiNotFoundResponse({
    description: 'Attempt not found or access denied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getAttempt(
    @Param('id') id: string,
    @GetUser() user: UserResponseDto,
  ): Promise<{
    message: string;
    data: AttemptDetailResponseDto;
  }> {
    const attempt = await this.mockTestAttemptsService.findOne(id, user.id);

    return {
      message: 'Attempt details retrieved successfully',
      data: attempt,
    };
  }
}
