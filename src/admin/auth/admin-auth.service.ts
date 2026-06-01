import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { AuthResponseDto } from '../../auth/dto/auth-response.dto';
import { JwtPayload } from '../../auth/auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { comparePassword } from '../../common/utils/password.util';
import { UserResponseDto } from '../../users/dto/user-response.dto';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(adminLoginDto: AdminLoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(
      adminLoginDto.email,
    );

    const invalidCredentials = () => {
      throw new UnauthorizedException('Invalid email or password');
    };

    if (!user) {
      invalidCredentials();
    }

    if (user.role !== UserRole.ADMIN || !user.passwordHash) {
      invalidCredentials();
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    const passwordValid = await comparePassword(
      adminLoginDto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      invalidCredentials();
    }

    const userDto = await this.usersService.findOne(user._id.toString());

    const jwtPayload: JwtPayload = {
      sub: userDto.id,
      phoneNumber: userDto.phoneNumber,
      role: userDto.role,
    };

    const accessToken = this.jwtService.sign(jwtPayload);
    this.logger.log(`Admin authenticated: ${userDto.id}`);

    return new AuthResponseDto(accessToken, userDto, false);
  }

  async getProfile(user: UserResponseDto): Promise<UserResponseDto> {
    return this.usersService.findOne(user.id);
  }
}
