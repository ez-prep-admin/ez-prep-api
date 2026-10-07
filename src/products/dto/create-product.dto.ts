import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductGrantDto } from './product-grant.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'SSC_CGL_COMPLETE' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'code must be alphanumeric or underscore',
  })
  code: string;

  @ApiProperty({ example: 'SSC CGL Complete' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ type: [ProductGrantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductGrantDto)
  @ArrayMinSize(0)
  grants?: ProductGrantDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  display?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
