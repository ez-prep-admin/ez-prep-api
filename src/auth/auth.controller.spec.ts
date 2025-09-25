import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    verifyOtpAndAuthenticate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyOtp', () => {
    const validDto = {
      accessToken: 'test-access-token',
    };

    it('should verify OTP and authenticate user successfully', async () => {
      const serviceResponse = {
        accessToken: 'new-jwt-token',
        isNewUser: false,
        user: {
          _id: '507f1f77bcf86cd799439011',
          name: 'John Doe',
          email: 'john@example.com',
          phoneNumber: '+1234567890',
          role: 'student',
          isActive: true,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
      };

      const expectedResponse = {
        message: 'Authentication successful',
        data: serviceResponse,
      };

      mockAuthService.verifyOtpAndAuthenticate.mockResolvedValue(
        serviceResponse,
      );

      const result = await controller.verifyOtp(validDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.verifyOtpAndAuthenticate).toHaveBeenCalledWith(
        validDto,
      );
    });

    it('should handle authentication failure', async () => {
      mockAuthService.verifyOtpAndAuthenticate.mockRejectedValue(
        new UnauthorizedException('Invalid OTP'),
      );

      await expect(controller.verifyOtp(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle service errors', async () => {
      mockAuthService.verifyOtpAndAuthenticate.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(controller.verifyOtp(validDto)).rejects.toThrow();
    });
  });
});
