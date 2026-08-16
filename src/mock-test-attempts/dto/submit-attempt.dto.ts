import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateAnswerDto } from './update-answer.dto';

export class SubmitAttemptDto {
  @ApiPropertyOptional({
    description:
      'Optional last-second answers applied before scoring. Ignored if the timer is more than 10s over. Session-wise: out-of-session ids are skipped. Prefer PATCH .../answer during the test.',
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
