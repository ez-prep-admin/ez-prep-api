/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token for authenticated requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Indicates if this is a new user (first-time login)',
    example: false,
  })
  isNewUser: boolean;

  constructor(
    accessToken: string,
    user: UserResponseDto,
    isNewUser: boolean = false,
  ) {
    this.accessToken = accessToken;
    this.user = user;
    this.isNewUser = isNewUser;
  }
}
