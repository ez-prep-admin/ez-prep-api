import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { UserDashboardDto } from './dto/user-dashboard.dto';
import { LeaderboardEntryDto, UserRankDto } from './dto/leaderboard-entry.dto';
import { RecentActivityItemDto } from './dto/recent-activity.dto';
import { SubjectTopicBreakdownDto } from './dto/topic-performance.dto';
import { UserBadgesDto } from './dto/badges.dto';
import { AiInsightsDto } from './dto/ai-insights.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get personal analytics dashboard',
    description:
      'Returns a complete analytics dashboard for the authenticated user including streak, scores, accuracy, time investment, and performance breakdowns by subject and exam.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: UserDashboardDto,
  })
  async getDashboard(
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: UserDashboardDto }> {
    const data = await this.analyticsService.getDashboard(user.id);
    return { message: 'Dashboard retrieved successfully', data };
  }

  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get leaderboard rankings',
    description:
      "Returns paginated leaderboard of all users ranked by average score percentage. Optionally filter by exam or subject. Always includes the current user's own rank even if not on the requested page.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'examId',
    required: false,
    type: String,
    description: 'Filter rankings to attempts under a specific exam',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    type: String,
    description: 'Filter rankings to attempts under a specific subject',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
    type: LeaderboardEntryDto,
    isArray: true,
  })
  async getLeaderboard(
    @GetUser() user: UserResponseDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('examId') examId?: string,
    @Query('subjectId') subjectId?: string,
  ): Promise<{
    message: string;
    data: LeaderboardEntryDto[];
    pagination: PaginationMetaDto;
    currentUserRank: UserRankDto;
  }> {
    const result = await this.analyticsService.getLeaderboard(
      user.id,
      page,
      limit,
      examId,
      subjectId,
    );
    return { message: 'Leaderboard retrieved successfully', ...result };
  }

  @Get('recent-activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get recent test activity',
    description:
      'Returns the most recent completed test attempts for the authenticated user with detailed scores, marks breakdown (correct/incorrect/unanswered), time consumed, and populated subject/exam/topic details (including descriptions).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of recent activities to return (default: 10, max: 20)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    type: RecentActivityItemDto,
    isArray: true,
  })
  async getRecentActivity(
    @GetUser() user: UserResponseDto,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{ message: string; data: RecentActivityItemDto[] }> {
    const data = await this.analyticsService.getRecentActivity(user.id, limit);
    return { message: 'Recent activity retrieved successfully', data };
  }

  @Get('subject-topic-breakdown')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get subject and topic performance breakdown',
    description:
      'Returns detailed performance breakdown by subject with nested topic-level metrics, accuracy, and trend indicators (improving/declining/stable).',
  })
  @ApiResponse({
    status: 200,
    description: 'Subject-topic breakdown retrieved successfully',
    type: SubjectTopicBreakdownDto,
  })
  async getSubjectTopicBreakdown(
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: SubjectTopicBreakdownDto }> {
    const data = await this.analyticsService.getSubjectTopicBreakdown(user.id);
    return {
      message: 'Subject-topic breakdown retrieved successfully',
      data,
    };
  }

  @Get('badges')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user badges and achievements',
    description:
      'Returns all available badges with earned/not-earned status for the authenticated user. Badges are computed from test performance data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Badges retrieved successfully',
    type: UserBadgesDto,
  })
  async getBadges(
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: UserBadgesDto }> {
    const data = await this.analyticsService.getUserBadges(user.id);
    return { message: 'Badges retrieved successfully', data };
  }

  @Get('ai-insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AI-powered performance insights',
    description:
      "Returns an intelligent analysis of the user's performance including a summary, detailed subject-topic breakdown, and prioritized recommendations for improvement.",
  })
  @ApiResponse({
    status: 200,
    description: 'AI insights retrieved successfully',
    type: AiInsightsDto,
  })
  async getAiInsights(
    @GetUser() user: UserResponseDto,
  ): Promise<{ message: string; data: AiInsightsDto }> {
    const data = await this.analyticsService.getAiInsights(user.id);
    return { message: 'AI insights retrieved successfully', data };
  }
}
