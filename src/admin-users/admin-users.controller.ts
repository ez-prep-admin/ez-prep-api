import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { UserRole } from '../common/enums/user-role.enum';
import { AdminUsersService } from './admin-users.service';
import { AppUserDetailApiResponseDto } from './dto/app-user-detail.dto';
import { AppUsersListApiResponseDto } from './dto/paginated-app-users-response.dto';

@ApiTags('admin-users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List app learners (Admin only)',
    description:
      'Paginated directory of student accounts (`role=user` only). ' +
      'Admin accounts are excluded in the query and again before the response is built. ' +
      'There is no `role` query parameter — this endpoint cannot list admins. ' +
      'Email and phone number are masked in the response; `search` still matches the stored name, email, or phone. ' +
      '`testsAttendedCount` is every mock-test attempt for the learner. ' +
      '`testActivity` splits that total by paper type (`FULL_EXAM` vs topic-wise) ' +
      'and by whether the attempt is finished (`SUBMITTED` or `EXPIRED`) ' +
      'or still open (started, in progress, or paused).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 12 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive match against name, email, or phone number',
  })
  @ApiOkResponse({ type: AppUsersListApiResponseDto })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<AppUsersListApiResponseDto> {
    const result = await this.adminUsersService.listAppUsers(
      page,
      limit,
      search,
    );

    return {
      message: 'App users retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get one app learner with performance (Admin only)',
    description:
      'Profile for a student account (`role=user` only). Admin accounts and unknown ids are not found. ' +
      'Email and phone number are masked. ' +
      '`recentTopicWiseAttempts` and `recentFullExamAttempts` are the newest finished attempts ' +
      '(`SUBMITTED` or `EXPIRED`), at most five each. A shorter list is returned when fewer finished attempts exist. ' +
      'Started, in-progress, and paused attempts are counted on `profile.testActivity` and are not scored. ' +
      '`analysis` covers every finished attempt: marks obtained out of marks available, accuracy, pass rate, and recent form.',
  })
  @ApiParam({ name: 'id', description: 'Learner user id' })
  @ApiOkResponse({ type: AppUserDetailApiResponseDto })
  @ApiNotFoundResponse({ description: 'Learner not found' })
  async getOne(@Param('id') id: string): Promise<AppUserDetailApiResponseDto> {
    const data = await this.adminUsersService.getAppUserDetails(id);
    return {
      message: 'App user retrieved successfully',
      data,
    };
  }
}
