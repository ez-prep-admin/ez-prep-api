import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    description: 'Subject name',
    example: 'Quantitative Aptitude',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Subject description',
    example: 'Mathematics and problem solving',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Array of topic IDs',
    example: ['64f123456789abcdef123456', '64f123456789abcdef123457'],
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  topics?: string[];
}
