/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and authenticate user',
    description: `
    Verifies the access token received from MSG91 OTP widget and authenticates the user.
    This endpoint handles both login and signup in a single flow:
    - If the phone number exists in the database, the user is logged in
    - If the phone number is new, a user account is created automatically
    
    Frontend Flow:
    1. User enters phone number in MSG91 widget
    2. User receives and enters OTP
    3. Widget validates OTP and returns access token
    4. Frontend calls this endpoint with the access token
    5. Backend verifies token with MSG91, checks/creates user, returns JWT
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully and user authenticated',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data or missing access token',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired access token, or account deactivated',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const authResponse =
      await this.authService.verifyOtpAndAuthenticate(verifyOtpDto);

    const message = authResponse.isNewUser
      ? 'Account created and authenticated successfully'
      : 'Authentication successful';

    return {
      message,
      data: authResponse,
    };
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create an admin account',
    description: `
Creates an admin in the users collection (\`role: admin\`) with a username and password.

- **First admin (bootstrap):** no JWT required. Use this once from Postman.
- **Later admins:** send an existing admin JWT in \`Authorization: Bearer <token>\`.

OTP / student accounts are unchanged. Admins sign in via \`POST /auth/admin/login\`.
    `,
  })
  @ApiCreatedResponse({
    description: 'Admin created',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Username or email already in use' })
  @ApiForbiddenResponse({
    description: 'An admin already exists and the caller is not an admin',
  })
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @GetUser() actor?: UserResponseDto,
  ): Promise<{ message: string; data: UserResponseDto }> {
    const admin = await this.authService.createAdmin(dto, actor);
    return {
      message: 'Admin created successfully',
      data: admin,
    };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Admin username/password login',
    description:
      'Authenticates an admin account and returns a JWT. Student OTP login is unchanged (`POST /auth/verify-otp`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin authenticated',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async loginAdmin(@Body() dto: AdminLoginDto): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const authResponse = await this.authService.loginAdmin(dto);
    return {
      message: 'Authentication successful',
      data: authResponse,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile information of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing JWT token',
  })
  async getProfile(@GetUser() user: UserResponseDto): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    return {
      message: 'Profile retrieved successfully',
      data: user,
    };
  }
}
