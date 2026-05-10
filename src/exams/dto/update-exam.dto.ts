import { PartialType } from '@nestjs/swagger';
import { CreateExamDto } from './create-exam.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateExamDto extends PartialType(CreateExamDto) {
  @ApiPropertyOptional({
    description: 'Active status of the exam',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
