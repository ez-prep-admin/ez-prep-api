import { UnauthorizedException } from '@nestjs/common';
import { OtpIdentityStrategy } from './otp-identity.strategy';
import { StudentAuthProvider } from './verified-student-identity';

describe('OtpIdentityStrategy', () => {
  const msg91 = { verifyAccessToken: jest.fn() };
  const strategy = new OtpIdentityStrategy(msg91 as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the phone number proven by MSG91', async () => {
    msg91.verifyAccessToken.mockResolvedValue('  +911234567890  ');

    await expect(strategy.verify('access-token')).resolves.toEqual({
      provider: StudentAuthProvider.OTP,
      phoneNumber: '+911234567890',
    });
  });

  it('rejects a non-string verification result', async () => {
    msg91.verifyAccessToken.mockResolvedValue(null);

    await expect(strategy.verify('access-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an empty verification result', async () => {
    msg91.verifyAccessToken.mockResolvedValue('   ');

    await expect(strategy.verify('access-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
