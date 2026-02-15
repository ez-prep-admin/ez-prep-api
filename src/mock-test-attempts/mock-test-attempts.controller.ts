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
} from '@nestjs/swagger';
import { MockTestAttemptsService } from './mock-test-attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { StartAttemptResponseDto } from './dto/start-attempt-response.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';

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
    Starts a new attempt for the specified mock test.
    
    Validations:
    - Mock test must exist and be active
    - If retakes are not allowed, user cannot have existing attempts
    - User cannot have multiple IN_PROGRESS attempts for the same test
    
    Creates an attempt with:
    - Frozen test configuration (marks, duration, etc.)
    - Locked question set
    - Initial state as IN_PROGRESS
    
    Returns questions without correct answers or explanations.
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
    Includes basic test information (title, questions count, duration).
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User attempts retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMyAttempts(@GetUser() user: UserResponseDto): Promise<{
    message: string;
    data: any[];
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
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User test attempts retrieved successfully',
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
    data: any[];
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
    - Test must not have expired (based on startedAt + durationInMinutes)
    - Question must be part of the attempt
    
    If the test has expired, the attempt status is automatically updated to EXPIRED.
    
    Note: This endpoint only saves the answer. Evaluation happens during submission.
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

  @Post(':attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit mock test attempt and get results',
    description: `
    Submits the mock test attempt for evaluation.
    
    Process:
    1. Validates attempt (exists, belongs to user, status = IN_PROGRESS)
    2. Server-side timer check (if expired, marks as EXPIRED but still evaluates)
    3. Optionally accepts final answers array with grace period protection:
       - If within time limit: Accepts all answers
       - If expired within 10s grace period: Accepts answers (network delay tolerance)
       - If exceeded beyond grace period: Rejects answers (anti-cheat), evaluates existing answers only
    4. Evaluates all questions:
       - Correct answer: +marksPerQuestion
       - Incorrect answer: -negativeMarking
       - Unanswered: 0 (no negative marking)
    5. Calculates total score and pass/fail status
    6. Updates attempt (score, status = SUBMITTED/EXPIRED, submittedAt)
    7. Returns results:
       - If showResultsImmediately = true: Full results with correct answers and explanations
       - If showResultsImmediately = false: Only submission confirmation and basic stats
    
    Security: Grace period prevents manipulation while allowing for network delays.
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

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific attempt by ID',
    description: `
    Retrieves detailed information about a specific attempt.
    Users can only access their own attempts.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Attempt retrieved successfully',
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
    data: any;
  }> {
    const attempt = await this.mockTestAttemptsService.findOne(id, user.id);

    return {
      message: 'Attempt retrieved successfully',
      data: attempt,
    };
  }
}
