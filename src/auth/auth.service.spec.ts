import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Msg91Service } from './services/msg91.service';
import { UnauthorizedException } from '@nestjs/common';
import {
  mockJwtService,
  mockMsg91Service,
  mockUsers,
} from '../../test/fixtures';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let msg91Service: Msg91Service;

  // Mock UsersService
  const mockUsersService = {
    findByPhone: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: Msg91Service,
          useValue: mockMsg91Service,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    msg91Service = module.get<Msg91Service>(Msg91Service);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyOtpAndAuthenticate', () => {
    const validDto = {
      accessToken: 'test-access-token',
    };

    describe('existing user login', () => {
      it('should authenticate existing user successfully', async () => {
        const existingUser = mockUsers.validStudent;

        mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');
        mockUsersService.findByPhone.mockResolvedValue(existingUser);
        mockJwtService.sign.mockReturnValue('mock-jwt-token');

        const result = await service.verifyOtpAndAuthenticate(validDto);

        expect(msg91Service.verifyAccessToken).toHaveBeenCalledWith(
          validDto.accessToken,
        );
        expect(usersService.findByPhone).toHaveBeenCalledWith('+1234567890');
        expect(jwtService.sign).toHaveBeenCalledWith({
          sub: existingUser.id,
          phoneNumber: existingUser.phoneNumber,
          role: existingUser.role,
        });
        expect(result.user).toEqual(existingUser);
        expect(result.accessToken).toBe('mock-jwt-token');
      });

      it('should throw UnauthorizedException for inactive user', async () => {
        const inactiveUser = { ...mockUsers.inactiveUser, isActive: false };

        mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567893');
        mockUsersService.findByPhone.mockResolvedValue(inactiveUser);

        await expect(
          service.verifyOtpAndAuthenticate(validDto),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('new user registration', () => {
      it('should register new user successfully', async () => {
        const newUser = mockUsers.validStudent;

        mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');
        mockUsersService.findByPhone.mockResolvedValue(null);
        mockUsersService.create.mockResolvedValue(newUser);
        mockJwtService.sign.mockReturnValue('mock-jwt-token');

        const result = await service.verifyOtpAndAuthenticate(validDto);

        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            phoneNumber: '+1234567890',
          }),
        );
        expect(result.user).toEqual(newUser);
        expect(result.accessToken).toBe('mock-jwt-token');
        expect(result.isNewUser).toBe(true);
      });

      it('should handle user creation failure', async () => {
        mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');
        mockUsersService.findByPhone.mockResolvedValue(null);
        mockUsersService.create.mockRejectedValue(new Error('Creation failed'));

        await expect(
          service.verifyOtpAndAuthenticate(validDto),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('OTP verification failures', () => {
      it('should throw UnauthorizedException for invalid OTP', async () => {
        mockMsg91Service.verifyAccessToken.mockResolvedValue(null);

        await expect(
          service.verifyOtpAndAuthenticate(validDto),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should handle MSG91 service errors during verification', async () => {
        mockMsg91Service.verifyAccessToken.mockRejectedValue(
          new Error('Verification failed'),
        );

        await expect(
          service.verifyOtpAndAuthenticate(validDto),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('validateJwtPayload', () => {
    it('should validate JWT payload successfully', async () => {
      const user = mockUsers.validStudent;
      const payload = {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await service.validateJwtPayload(payload);

      expect(usersService.findOne).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException for invalid user ID', async () => {
      const payload = {
        sub: 'invalid-id',
        phoneNumber: '+1234567890',
        role: 'USER',
      };
      mockUsersService.findOne.mockRejectedValue(new Error('User not found'));

      await expect(service.validateJwtPayload(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUsers.inactiveUser, isActive: false };
      const payload = {
        sub: inactiveUser.id,
        phoneNumber: inactiveUser.phoneNumber,
        role: inactiveUser.role,
      };
      mockUsersService.findOne.mockResolvedValue(inactiveUser);

      await expect(service.validateJwtPayload(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockUsersService.findByPhone.mockRejectedValue(
        new Error('Database connection failed'),
      );
      mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');

      await expect(
        service.verifyOtpAndAuthenticate({
          accessToken: 'test-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle JWT signing errors', async () => {
      const user = mockUsers.validStudent;

      mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');
      mockUsersService.findByPhone.mockResolvedValue(user);
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(
        service.verifyOtpAndAuthenticate({
          accessToken: 'test-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('integration scenarios', () => {
    it('should handle concurrent authentication requests', async () => {
      const user = mockUsers.validStudent;
      mockMsg91Service.verifyAccessToken.mockResolvedValue('+1234567890');
      mockUsersService.findByPhone.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const requests = Array(5)
        .fill(null)
        .map(() =>
          service.verifyOtpAndAuthenticate({
            accessToken: 'test-token',
          }),
        );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.accessToken).toBe('mock-jwt-token');
        expect(result.user).toEqual(user);
      });
    });

    it('should maintain phone number format consistency', async () => {
      const phoneVariations = ['+1234567890', '1234567890', '+91-9876543210'];

      for (const phone of phoneVariations) {
        mockMsg91Service.verifyAccessToken.mockResolvedValue(phone);
        mockUsersService.findByPhone.mockResolvedValue(null);
        mockUsersService.create.mockResolvedValue(mockUsers.validStudent);

        await service.verifyOtpAndAuthenticate({
          accessToken: 'test-token',
        });

        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({ phoneNumber: phone }),
        );
      }
    });
  });
});
