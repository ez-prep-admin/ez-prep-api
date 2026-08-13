import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const SIZE_OPTIONS = [10, 15, 20, 25, 30] as const;

export class DifficultyDistributionInputDto {
  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(0)
  easy: number;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(0)
  medium: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  hard: number;
}

export class CreateTopicWiseMockTestDto {
  @ApiProperty({ enum: SIZE_OPTIONS })
  @IsIn(SIZE_OPTIONS)
  totalQuestions: number;

  @ApiProperty({ enum: SIZE_OPTIONS })
  @IsIn(SIZE_OPTIONS)
  durationInMinutes: number;

  @ApiProperty()
  @IsMongoId()
  exam: string;

  @ApiProperty()
  @IsMongoId()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  topic?: string;

  @ApiProperty({ type: DifficultyDistributionInputDto })
  @ValidateNested()
  @Type(() => DifficultyDistributionInputDto)
  difficultyDistribution: DifficultyDistributionInputDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['STATIC', 'DYNAMIC'] })
  @IsOptional()
  @IsEnum(['STATIC', 'DYNAMIC'])
  generationMode?: 'STATIC' | 'DYNAMIC';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksPerQuestion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarking?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean;
}
