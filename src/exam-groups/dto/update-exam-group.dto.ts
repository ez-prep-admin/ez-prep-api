import { PartialType } from '@nestjs/swagger';
import { CreateExamGroupDto } from './create-exam-group.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateExamGroupDto extends PartialType(CreateExamGroupDto) {
  @ApiPropertyOptional({
    description: 'Active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
