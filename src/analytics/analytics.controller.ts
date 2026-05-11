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
}
