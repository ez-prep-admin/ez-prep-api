import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleSignInDto {
  @ApiProperty({
    description:
      'One-time authorization code from Google. The API exchanges this with the client secret and verifies the returned ID token.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code: string;

  @ApiProperty({
    description:
      'Redirect URI used in the Google authorization request. It must match a URI in GOOGLE_REDIRECT_URIS exactly.',
    example: 'http://localhost:3001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  redirectUri: string;

  @ApiProperty({
    description:
      'PKCE code verifier that matches the code_challenge sent to Google.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(43)
  @MaxLength(128)
  codeVerifier: string;
}
