import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackCreatedDto } from './dto/feedback-response.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit feedback',
    description:
      'Stores a new feedback note for the signed-in learner. ' +
      'Each call inserts a new document. At least a written note or one rating is required.',
  })
  @ApiCreatedResponse({ type: FeedbackCreatedDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or the note and every rating were empty',
  })
  async create(
    @GetUser() currentUser: UserResponseDto,
    @Body() dto: CreateFeedbackDto,
  ): Promise<{ message: string; data: FeedbackCreatedDto }> {
    const data = await this.feedbackService.create(currentUser.id, dto);
    return { message: 'Feedback submitted successfully', data };
  }
}
