import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new user account with validation and uniqueness checks for email and phone number',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid input data',
  })
  @ApiConflictResponse({
    description: 'Email or phone number already exists',
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.create(createUserDto);
    return {
      message: 'User created successfully',
      data: user,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieves all active users. Can be filtered by role.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filter users by role',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
  })
  async findAll(@Query('role') role?: UserRole): Promise<{
    message: string;
    data: UserResponseDto[];
    count: number;
  }> {
    const users = role
      ? await this.usersService.findByRole(role)
      : await this.usersService.findAll();

    return {
      message: 'Users retrieved successfully',
      data: users,
      count: users.length,
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user statistics (Admin only)',
    description:
      'Retrieves comprehensive user statistics. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async getUserStats(): Promise<{
    message: string;
    data: any;
  }> {
    const stats = await this.usersService.getUserStats();
    return {
      message: 'User statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('with-deleted')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users including deleted ones (Admin only)',
    description:
      'Retrieves all users including soft-deleted ones. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'All users retrieved successfully',
    type: [UserResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async findAllWithDeleted(): Promise<{
    message: string;
    data: UserResponseDto[];
    count: number;
  }> {
    const users = await this.usersService.findAllWithDeleted();
    return {
      message: 'All users (including deleted) retrieved successfully',
      data: users,
      count: users.length,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieves the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMyProfile(@GetUser() currentUser: UserResponseDto): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    return {
      message: 'Profile retrieved successfully',
      data: currentUser,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates the profile of the currently authenticated user. Users can only update their own profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid input data',
  })
  @ApiConflictResponse({
    description: 'Email or phone number already exists',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async updateMyProfile(
    @GetUser() currentUser: UserResponseDto,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    // Prevent users from updating certain fields like isDeleted
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isDeleted, ...safeUpdateData } = updateUserDto;

    const updatedUser = await this.usersService.update(
      currentUser.id,
      safeUpdateData,
    );
    return {
      message: 'Profile updated successfully',
      data: updatedUser,
    };
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update own extended profile',
    description:
      'Updates bio, avatar, date of birth, gender, location, and target exam for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateMyExtendedProfile(
    @GetUser() currentUser: UserResponseDto,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ message: string; data: UserResponseDto }> {
    const user = await this.usersService.updateProfile(currentUser.id, dto);
    return { message: 'Profile updated successfully', data: user };
  }

  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update own preferences and interactions',
    description:
      'Updates study time preference, weekly goal, notification settings, and interaction signals (liked/disliked topics, interested subjects/exams).',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateMyPreferences(
    @GetUser() currentUser: UserResponseDto,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<{ message: string; data: UserResponseDto }> {
    const user = await this.usersService.updatePreferences(currentUser.id, dto);
    return { message: 'Preferences updated successfully', data: user };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'User updated successfully',
      data: user,
    };
  }

  @Patch(':id/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user subscription (Admin only)',
    description:
      'Updates the subscription plan, status, and billing dates for a user. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<{ message: string; data: UserResponseDto }> {
    const user = await this.usersService.updateSubscription(id, dto);
    return { message: 'Subscription updated successfully', data: user };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.findOne(id);
    return {
      message: 'User retrieved successfully',
      data: user,
    };
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.toggleUserStatus(id);
    return {
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.softDelete(id);
    return {
      message: 'User deleted successfully (soft delete)',
      data: user,
    };
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.restore(id);
    return {
      message: 'User restored successfully',
      data: user,
    };
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hardDelete(@Param('id') id: string): Promise<void> {
    await this.usersService.hardDelete(id);
  }
}
