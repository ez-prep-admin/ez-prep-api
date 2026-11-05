import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthClient } from '../session/session.types';

export class VerifyOtpDto {
  @ApiProperty({
    description:
      'Access token received from MSG91 OTP widget after successful OTP verification',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Access token must be a valid string' })
  @IsNotEmpty({ message: 'Access token is required' })
  accessToken: string;

  @ApiPropertyOptional({
    description:
      'Client that is signing in. web sessions last 7 days; mobile sessions last 90 days. Defaults to web.',
    enum: ['web', 'mobile'],
    default: 'web',
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: AuthClient;
}
