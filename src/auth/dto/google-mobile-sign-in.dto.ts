import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
