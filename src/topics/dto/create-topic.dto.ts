import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateTopicDto {
  @ApiProperty({
    description: 'Topic name',
    example: 'Ratio & Proportion',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Topic description',
    example: 'Learn about ratios and proportions',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  description?: string;
}
