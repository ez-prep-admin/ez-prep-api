import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AuthResponseDto } from '../../auth/dto/auth-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login with email and password',
    description:
      'Authenticates an admin user with email and password. Returns a JWT token compatible with all admin API routes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() adminLoginDto: AdminLoginDto): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const authResponse = await this.adminAuthService.login(adminLoginDto);
    return {
      message: 'Authentication successful',
      data: authResponse,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current admin profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async getProfile(@GetUser() user: UserResponseDto): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const profile = await this.adminAuthService.getProfile(user);
    return {
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }
}
