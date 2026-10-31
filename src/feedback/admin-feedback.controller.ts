import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import {
  FeedbackListApiResponseDto,
  FeedbackSummaryDto,
} from './dto/feedback-response.dto';
import { FEEDBACK_DEFAULT_LIMIT } from './feedback.constants';
import { FeedbackService } from './feedback.service';

@ApiTags('admin-feedback')
@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aggregate feedback ratings (Admin)',
    description:
      'Overall rating is the mean of every stored star. ' +
      'Each category average ignores submissions that left that category blank.',
  })
  @ApiOkResponse({ type: FeedbackSummaryDto })
  async summary(): Promise<{ message: string; data: FeedbackSummaryDto }> {
    const data = await this.feedbackService.summary();
    return { message: 'Feedback summary retrieved successfully', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List feedback (Admin)',
    description: 'Newest submissions first. Written notes are not aggregated.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: FEEDBACK_DEFAULT_LIMIT,
  })
  @ApiOkResponse({ type: FeedbackListApiResponseDto })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(FEEDBACK_DEFAULT_LIMIT), ParseIntPipe)
    limit: number,
  ): Promise<FeedbackListApiResponseDto> {
    const result = await this.feedbackService.list(page, limit);
    return {
      message: 'Feedback retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
