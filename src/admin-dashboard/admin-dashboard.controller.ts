import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AdminDashboardAttemptsDto,
  AdminDashboardExamsDto,
  AdminDashboardFailedQuestionsDto,
  AdminDashboardFullMockTestsDto,
  AdminDashboardMockTestsDto,
  AdminDashboardQuestionsDto,
  AdminDashboardSubjectsDto,
  AdminDashboardSummaryDto,
  AdminDashboardTagsDto,
  AdminDashboardTopicsDto,
  AdminDashboardUsersDto,
} from './dto/admin-dashboard.dto';

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin dashboard summary counts' })
  @ApiOkResponse({ type: AdminDashboardSummaryDto })
  async getSummary(): Promise<{
    message: string;
    data: AdminDashboardSummaryDto;
  }> {
    const data = await this.adminDashboardService.getSummary();
    return { message: 'Admin dashboard summary retrieved successfully', data };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Learner user breakdown for admin dashboard' })
  @ApiOkResponse({ type: AdminDashboardUsersDto })
  async getUsers(): Promise<{ message: string; data: AdminDashboardUsersDto }> {
    const data = await this.adminDashboardService.getUsers();
    return { message: 'User dashboard details retrieved successfully', data };
  }

  @Get('questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Active questions by subject, topic, and difficulty' })
  @ApiOkResponse({ type: AdminDashboardQuestionsDto })
  async getQuestions(): Promise<{
    message: string;
    data: AdminDashboardQuestionsDto;
  }> {
    const data = await this.adminDashboardService.getQuestions();
    return {
      message: 'Question dashboard details retrieved successfully',
      data,
    };
  }

  @Get('failed-questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Failed import questions by stage and subject' })
  @ApiOkResponse({ type: AdminDashboardFailedQuestionsDto })
  async getFailedQuestions(): Promise<{
    message: string;
    data: AdminDashboardFailedQuestionsDto;
  }> {
    const data = await this.adminDashboardService.getFailedQuestions();
    return {
      message: 'Failed question dashboard details retrieved successfully',
      data,
    };
  }

  @Get('mock-tests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Topic-wise mock tests grouped by exam' })
  @ApiOkResponse({ type: AdminDashboardMockTestsDto })
  async getMockTests(): Promise<{
    message: string;
    data: AdminDashboardMockTestsDto;
  }> {
    const data = await this.adminDashboardService.getMockTests();
    return {
      message: 'Mock test dashboard details retrieved successfully',
      data,
    };
  }

  @Get('full-mock-tests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Published full-exam papers by exam and draft status counts',
  })
  @ApiOkResponse({ type: AdminDashboardFullMockTestsDto })
  async getFullMockTests(): Promise<{
    message: string;
    data: AdminDashboardFullMockTestsDto;
  }> {
    const data = await this.adminDashboardService.getFullMockTests();
    return {
      message: 'Full mock test dashboard details retrieved successfully',
      data,
    };
  }

  @Get('attempts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Attempts grouped by exam with time and completion stats',
  })
  @ApiOkResponse({ type: AdminDashboardAttemptsDto })
  async getAttempts(): Promise<{
    message: string;
    data: AdminDashboardAttemptsDto;
  }> {
    const data = await this.adminDashboardService.getAttempts();
    return {
      message: 'Attempt dashboard details retrieved successfully',
      data,
    };
  }

  @Get('exams')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Active and inactive exams grouped by category' })
  @ApiOkResponse({ type: AdminDashboardExamsDto })
  async getExams(): Promise<{ message: string; data: AdminDashboardExamsDto }> {
    const data = await this.adminDashboardService.getExams();
    return { message: 'Exam dashboard details retrieved successfully', data };
  }

  @Get('subjects')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subjects with topic counts' })
  @ApiOkResponse({ type: AdminDashboardSubjectsDto })
  async getSubjects(): Promise<{
    message: string;
    data: AdminDashboardSubjectsDto;
  }> {
    const data = await this.adminDashboardService.getSubjects();
    return {
      message: 'Subject dashboard details retrieved successfully',
      data,
    };
  }

  @Get('topics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Topics grouped by subject' })
  @ApiOkResponse({ type: AdminDashboardTopicsDto })
  async getTopics(): Promise<{
    message: string;
    data: AdminDashboardTopicsDto;
  }> {
    const data = await this.adminDashboardService.getTopics();
    return { message: 'Topic dashboard details retrieved successfully', data };
  }

  @Get('tags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tags grouped by subject' })
  @ApiOkResponse({ type: AdminDashboardTagsDto })
  async getTags(): Promise<{ message: string; data: AdminDashboardTagsDto }> {
    const data = await this.adminDashboardService.getTags();
    return { message: 'Tag dashboard details retrieved successfully', data };
  }
}
