import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'SSC',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Search query must not be empty' })
  @MinLength(1, { message: 'Search query must be at least 1 character' })
  @MaxLength(100, { message: 'Search query must not exceed 100 characters' })
  q: string;

  @ApiPropertyOptional({
    description:
      'Maximum results to return per collection (default: 10, max: 20)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
