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
