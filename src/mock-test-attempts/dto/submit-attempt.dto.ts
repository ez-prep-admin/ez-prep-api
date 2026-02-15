import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateAnswerDto } from './update-answer.dto';

export class SubmitAttemptDto {
  @ApiPropertyOptional({
    description:
      'Optional array of answers to update before submission (protects against last-second internet loss)',
    type: [UpdateAnswerDto],
    example: [
      {
        questionId: '67c5f4ee4d671dbf0cb95a12',
        selectedOptionId: 'fe99dedc-7c4b-445a-9c5f-03e5706bf184',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAnswerDto)
  answers?: UpdateAnswerDto[];
}
