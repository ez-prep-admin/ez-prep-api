import { IsNotEmpty, IsString, IsMongoId, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'Speed Math',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Tag description',
    example: 'Fast calculation techniques for competitive exams',
  })
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Topic ID',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  @IsNotEmpty()
  topic: string;
}
