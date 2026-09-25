/* eslint-disable prettier/prettier */
import {
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { OtpIdentityStrategy } from './identity/otp-identity.strategy';
import { GoogleIdentityStrategy } from './identity/google-identity.strategy';
import { GoogleCodeExchangeService } from './identity/google-code-exchange.service';
import { StudentAccountResolver } from './identity/student-account.resolver';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
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
    private readonly otpIdentity: OtpIdentityStrategy,
    private readonly googleCodes: GoogleCodeExchangeService,
    private readonly googleIdentity: GoogleIdentityStrategy,
    private readonly studentAccounts: StudentAccountResolver,
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
      const identity = await this.otpIdentity.verify(verifyOtpDto.accessToken);
      const { user, isNewUser } = await this.studentAccounts.resolve(identity);
      return this.issueStudentToken(user, isNewUser);
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
   * Exchange a Google authorization code, verify the ID token Google returns,
   * then issue the same student JWT used by OTP login.
   * A token supplied by the browser is never accepted in place of that check.
   */
  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResponseDto> {
    try {
      const idToken = await this.googleCodes.exchange({
        code: dto.code,
        redirectUri: dto.redirectUri,
        codeVerifier: dto.codeVerifier,
      });
      const identity = await this.googleIdentity.verify(idToken);
      const { user, isNewUser } = await this.studentAccounts.resolve(identity);
      return this.issueStudentToken(user, isNewUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Unexpected error during Google sign-in:', error.message);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private issueStudentToken(
    user: UserResponseDto,
    isNewUser: boolean,
  ): AuthResponseDto {
    const jwtPayload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };
    if (user.phoneNumber) {
      jwtPayload.phoneNumber = user.phoneNumber;
    }

    const accessToken = this.jwtService.sign(jwtPayload);
    this.logger.log(
      `JWT token generated for user: ${user.id}, isNewUser: ${isNewUser}`,
    );
    return new AuthResponseDto(accessToken, user, isNewUser);
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
