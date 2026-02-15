import { IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAttemptDto {
  @ApiProperty({
    description: 'Mock test ID to start the attempt',
    example: '69906253ca35c9fccf199668',
  })
  @IsString({ message: 'Mock test ID must be a string' })
  @IsMongoId({ message: 'Mock test ID must be a valid MongoDB ObjectId' })
  mockTestId: string;
}
