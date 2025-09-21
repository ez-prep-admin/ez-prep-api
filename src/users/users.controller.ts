import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new user',
    description: 'Creates a new user account with validation and uniqueness checks for email and phone number'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ 
    description: 'Validation failed or invalid input data' 
  })
  @ApiConflictResponse({ 
    description: 'Email or phone number already exists' 
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
    description: 'Retrieves all active users. Can be filtered by role.'
  })
  @ApiQuery({ 
    name: 'role', 
    required: false, 
    enum: UserRole,
    description: 'Filter users by role' 
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
