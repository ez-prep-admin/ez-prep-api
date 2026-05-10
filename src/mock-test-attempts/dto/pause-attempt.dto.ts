import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PauseAttemptDto {
  @ApiProperty({
    description: 'Attempt ID to pause',
    example: '64f123456789abcdef123456',
  })
  @IsNotEmpty()
  @IsString()
  attemptId: string;
}
