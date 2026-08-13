/* eslint-disable prettier/prettier */
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Msg91Service } from './services/msg91.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UserRole } from '../common/enums/user-role.enum';

export interface JwtPayload {
  sub: string; // user id
  phoneNumber?: string;
  username?: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly msg91Service: Msg91Service,
  ) {}

  /**
   * Verify OTP access token and authenticate user
   * This method handles both login and signup in a single flow
   * @param verifyOtpDto - Contains the access token from MSG91 widget
   * @returns AuthResponseDto with JWT token and user information
   */
  async verifyOtpAndAuthenticate(
    verifyOtpDto: VerifyOtpDto,
  ): Promise<AuthResponseDto> {
    try {
      this.logger.log('Starting OTP verification and authentication process');

      // Step 1: Verify access token with MSG91
      const phoneNumber = await this.msg91Service.verifyAccessToken(
        verifyOtpDto.accessToken,
      );
      this.logger.log(`Phone number verified: ${phoneNumber}`);

      // Step 2: Check if user exists
      let user: UserResponseDto;
      let isNewUser = false;

      const existingUser = await this.usersService.findByPhone(phoneNumber);

      if (existingUser) {
        // Existing user - login flow
        this.logger.log(`Existing user found for phone: ${phoneNumber}`);

        // Check if user is active
        if (!existingUser.isActive) {
          this.logger.warn(`Inactive user attempted login: ${phoneNumber}`);
          throw new UnauthorizedException(
            'Your account has been deactivated. Please contact support.',
          );
        }

        user = existingUser;

        if (user.role === UserRole.ADMIN) {
          throw new UnauthorizedException(
            'Admin accounts must sign in with username and password',
          );
        }
      } else {
        // New user - signup flow
        this.logger.log(`New user detected for phone: ${phoneNumber}`);
        isNewUser = true;

        // Create new user with phone number
        // Extract name from phone number (temporary) - user can update later
        const tempName = `User ${phoneNumber.slice(-4)}`;
        const tempEmail = `user${phoneNumber.replace(/\D/g, '')}@temp.ezprep.com`;

        const createUserDto: CreateUserDto = {
          name: tempName,
          email: tempEmail,
          phoneNumber: phoneNumber,
          // role defaults to USER
        };

        try {
          user = await this.usersService.create(createUserDto);
          this.logger.log(`New user created successfully: ${user.id}`);
        } catch (error) {
          this.logger.error('Failed to create new user:', error.message);
          throw new UnauthorizedException('Failed to create user account');
        }
      }

      // Step 3: Generate JWT token
      const jwtPayload: JwtPayload = {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(jwtPayload);
      this.logger.log(`JWT token generated for user: ${user.id}`);

      // Step 4: Return authentication response
      const authResponse = new AuthResponseDto(accessToken, user, isNewUser);

      this.logger.log(
        `Authentication successful for user: ${user.id}, isNewUser: ${isNewUser}`,
      );
      return authResponse;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        'Unexpected error during authentication:',
        error.message,
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Create an admin account (username + password).
   * The first admin may be created with no token (bootstrap).
   * After that, only an authenticated admin may create more.
   */
  async createAdmin(
    dto: CreateAdminDto,
    actor?: UserResponseDto,
  ): Promise<UserResponseDto> {
    if (actor && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only an existing admin can create another admin',
      );
    }

    const passwordAdminCount = await this.usersService.countPasswordAdmins();
    if (passwordAdminCount > 0 && actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only an existing admin can create another admin',
      );
    }

    const admin = await this.usersService.createAdmin(dto);
    this.logger.log(`Admin account created: ${admin.username} (${admin.id})`);
    return admin;
  }

  /**
   * Username/password login for admin accounts only.
   */
  async loginAdmin(dto: AdminLoginDto): Promise<AuthResponseDto> {
    const userDoc = await this.usersService.findByUsernameForAuth(dto.username);

    if (
      !userDoc ||
      userDoc.role !== UserRole.ADMIN ||
      !userDoc.passwordHash ||
      !userDoc.isActive
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      userDoc.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const user = await this.usersService.findOne(userDoc._id.toString());
    const jwtPayload: JwtPayload = {
      sub: user.id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: '30d',
    });

    this.logger.log(`Admin login successful: ${user.username} (${user.id})`);
    return new AuthResponseDto(accessToken, user, false);
  }

  /**
   * Validate JWT token and return user payload
   * Used by JWT strategy for route protection
   * @param payload - JWT payload
   * @returns User information if valid
   */
  async validateJwtPayload(payload: JwtPayload): Promise<UserResponseDto> {
    try {
      this.logger.log(`Validating JWT payload for user: ${payload.sub}`);

      const user = await this.usersService.findOne(payload.sub);

      if (!user.isActive) {
        this.logger.warn(`Inactive user attempted to use JWT: ${payload.sub}`);
        throw new UnauthorizedException('Account is deactivated');
      }

      return user;
    } catch (error) {
      this.logger.error('JWT payload validation failed:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
