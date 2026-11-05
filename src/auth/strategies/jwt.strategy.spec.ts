import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JWT_PAYLOAD_REQUEST_KEY } from './jwt.strategy';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const mockAuthService = {
    validateJwtPayload: jest.fn(),
  };
  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return the user when payload is valid and stash the payload', async () => {
    const payload = { sub: '1', phoneNumber: '+1', role: 'user', sid: 's1' };
    const user = { id: '1' };
    const req = {} as Record<string, unknown>;
    mockAuthService.validateJwtPayload.mockResolvedValue(user);

    await expect(
      strategy.validate(req as never, payload as never),
    ).resolves.toEqual(user);
    expect(req[JWT_PAYLOAD_REQUEST_KEY]).toEqual(payload);
    expect(mockAuthService.validateJwtPayload).toHaveBeenCalledWith(payload);
  });

  it('should throw UnauthorizedException when user is missing', async () => {
    mockAuthService.validateJwtPayload.mockResolvedValue(null);

    await expect(
      strategy.validate({} as never, { sub: 'missing' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
