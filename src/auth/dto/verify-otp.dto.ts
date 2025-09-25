import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description:
      'Access token received from MSG91 OTP widget after successful OTP verification',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Access token must be a valid string' })
  @IsNotEmpty({ message: 'Access token is required' })
  accessToken: string;
}
