import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Msg91Service } from '../services/msg91.service';
import {
  StudentAuthProvider,
  VerifiedStudentIdentity,
} from './verified-student-identity';

@Injectable()
export class OtpIdentityStrategy {
  constructor(private readonly msg91Service: Msg91Service) {}

  async verify(accessToken: string): Promise<VerifiedStudentIdentity> {
    const phoneNumber = await this.msg91Service.verifyAccessToken(accessToken);
    const normalized =
      typeof phoneNumber === 'string' ? phoneNumber.trim() : '';

    if (!normalized) {
      throw new UnauthorizedException('Authentication failed');
    }

    return {
      provider: StudentAuthProvider.OTP,
      phoneNumber: normalized,
    };
  }
}
