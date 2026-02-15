import { IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAnswerDto {
  @ApiProperty({
    description: 'Question ID (MongoDB ObjectId)',
    example: '67c5f4ee4d671dbf0cb95a12',
  })
  @IsString({ message: 'Question ID must be a string' })
  @IsMongoId({ message: 'Question ID must be a valid MongoDB ObjectId' })
  questionId: string;

  @ApiProperty({
    description: 'Selected option ID (UUID from option.id field)',
    example: 'fe99dedc-7c4b-445a-9c5f-03e5706bf184',
  })
  @IsString({ message: 'Selected option ID must be a string' })
  selectedOptionId: string;
}
