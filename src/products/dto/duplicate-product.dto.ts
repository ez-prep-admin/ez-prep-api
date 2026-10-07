import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DuplicateProductDto {
  @ApiPropertyOptional({
    description: 'New unique code; defaults to CODE_COPY',
    example: 'SSC_CGL_COMPLETE_V2',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'code must be alphanumeric or underscore',
  })
  code?: string;
}
