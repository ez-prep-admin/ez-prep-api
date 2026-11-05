import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthClient } from '../session/session.types';

export class GoogleMobileSignInDto {
  @ApiProperty({
    description:
      'Google ID token from the mobile Sign-In SDK. The API verifies it with Google. The web authorization-code endpoint is unchanged.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(8192)
  idToken: string;

  @ApiPropertyOptional({
    description:
      'Client that is signing in. Defaults to mobile for this endpoint.',
    enum: ['web', 'mobile'],
    default: 'mobile',
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: AuthClient;
}
