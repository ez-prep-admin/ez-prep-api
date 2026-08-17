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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminUsersService } from './admin-users.service';
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
      '`testsAttendedCount` is a simple count of mock-test-attempt documents per user.',
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
}
