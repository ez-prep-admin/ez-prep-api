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
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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
