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
Starts an attempt for a **topic-wise** paper (\`GET /mock-tests\`) or a **published full exam** (\`GET /full-mock-tests\`). Same endpoint. Drafts are not attemptable.

**Do not call start** when the catalog \`userAttemptAction\` is \`RESUME\` — use \`GET /mock-test-attempts/{resumeAttemptId}/resume\` instead.

### Topic-wise and mixed full exams (\`isSessionWise\` is false)
- One timer: \`mockTestData.durationInMinutes\`
- Render **all** \`questions\`
- \`sessions\` and \`currentSessionIndex\` are omitted
- Mixed full exams may still include \`sessionOrder\` on questions (subject-block index) for grouping. Still one timer; do **not** call sessions/complete.

### Session-wise full exams (\`isSessionWise\` is true)
- \`questions\` is the **entire paper**, already grouped into contiguous subject blocks
- Each question has \`sessionOrder\` (same as \`sessions[].order\`)
- Each session has frozen \`questionIds\`, \`questionCount\`, and its own \`durationInMinutes\`
- Only session 0 is \`IN_PROGRESS\`; the rest are \`LOCKED\`
- **Timer:** use the current session's \`durationInMinutes\`, not the paper-level duration (that value is the sum of sessions)
- **UI:** show only questions where \`sessionOrder\` matches the current session **and** \`_id\` is in that session's \`questionIds\`. Do not group by live \`question.subject\`. Do not use \`startIndex\`/\`endIndex\` in the UI.
- When the student finishes the subject (or the session timer runs out), call \`POST /mock-test-attempts/{attemptId}/sessions/complete\`

Keys and explanations are never returned here.
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
      'Retake not allowed, or an IN_PROGRESS attempt already exists (use GET .../resume with resumeAttemptId from the catalog)',
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
    summary: 'Save an answer',
    description: `
Saves \`selectedOptionId\` for one question. No scoring here.

- Attempt must be \`IN_PROGRESS\` (resume first if paused)
- Session-wise: the question must belong to the **current** session (\`questionIds\` / \`sessionOrder\`). Other sessions return 400.
- If the **current session** timer has expired: 400 — call \`POST .../sessions/complete\` (do not keep answering)
- If the whole paper / last session has expired: attempt becomes \`EXPIRED\`
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
    summary: 'Pause the running timer',
    description: `
Freezes the clock and keeps all saved answers. Cannot answer until resume.

- Topic-wise / mixed: pauses the paper timer
- Session-wise: pauses the **current session** timer only
- Adds a 10s grace to consumed time (network). If no time remains, pause is refused — submit or complete-session instead
- Continue with \`GET /mock-test-attempts/{attemptId}/resume\` (that call unpauses)
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
    summary: 'Finish the current subject session (session-wise only)',
    description: `
**Only for \`isSessionWise: true\`.** Topic-wise and mixed papers must use \`POST .../submit\`.

Locks the current subject (answers kept, not scored yet). The student cannot go back or skip ahead.

**Before calling:** attempt must be \`IN_PROGRESS\`. If \`PAUSED\`, resume first.

**After a session timer hits zero:** the server does **not** open the next subject by itself. The client must call this endpoint.

### Response
- \`paperCompleted: false\` — next subject is unlocked. \`nextSession\` has the same shape as resume: **full** \`questions\` array still. Filter with the new \`currentSessionIndex\` / \`sessionOrder\` / \`questionIds\`. Use \`nextSession.timeRemaining\` for the new timer.
- \`paperCompleted: true\` — this was the last session. The **whole paper** is scored. Show \`results\` (same as submit). Do **not** call submit again.

**Retry:** if this request times out, \`GET .../resume\` and inspect \`sessions[].status\` / \`currentSessionIndex\` before calling complete again. A successful complete followed by another complete will finish the **next** subject.
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
    summary: 'Submit the paper and score it',
    description: `
Scores the attempt. Use this for:
- Topic-wise papers
- Mixed full exams (one timer)
- Session-wise papers **only on the last session**

If session-wise and not on the last subject: 400 — call \`POST .../sessions/complete\` instead.

Optional \`answers[]\` is applied first (10s grace after the timer for last-second network). Unknown or out-of-session question ids are skipped.

Scoring: unanswered = 0 (no penalty). Wrong = minus the frozen negative marks for that question. \`passed\` is \`score >= passingScore\`; if \`passingScore\` was never set, \`passed\` is false.

Keys/explanations are included only when \`showResultsImmediately\` is true.
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
    summary: 'Resume an in-progress or paused attempt',
    description: `
Use for page reload, reconnect, returning from pause, or when the catalog \`userAttemptAction\` is \`RESUME\`.

**Not a read-only GET.** If the attempt is \`PAUSED\`, this call **unpauses** it and restarts the running clock (\`startedAt = now\`). Accumulated \`timeConsumed\` is kept.

Response matches start, plus \`selectedOption\` on answered questions and \`timeElapsed\` / \`timeRemaining\` (session timer if session-wise). Questions are in locked paper order with \`sessionOrder\` / \`sessions[].questionIds\` when session-wise.

\`SUBMITTED\` / \`EXPIRED\`: 400 — use \`GET /mock-test-attempts/{id}\` for results.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt details for resuming retrieved successfully',
    type: ResumeAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid attempt ID, attempt is SUBMITTED/EXPIRED (use GET /:id for results), or fully expired',
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
    summary: 'Get attempt detail or results',
    description: `
Owner-only. For taking an in-progress test, prefer \`GET .../resume\` (resume unpauses). This route is the results / inspection endpoint.

IN_PROGRESS / PAUSED: selected answers, time remaining, session fields when session-wise (\`sessionOrder\`, \`sessions[].questionIds\`). No keys.

SUBMITTED / EXPIRED: score, counts, \`isPassed\`. Per-question keys and explanations only if \`showResultsImmediately\`.
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
