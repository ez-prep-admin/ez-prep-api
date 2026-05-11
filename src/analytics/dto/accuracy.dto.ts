import { ApiProperty } from '@nestjs/swagger';

export class AccuracyDto {
  @ApiProperty({
    description:
      'Total questions answered correctly across all completed attempts',
    example: 312,
  })
  totalCorrect: number;

  @ApiProperty({
    description: 'Total questions that were attempted (selected an option)',
    example: 420,
  })
  totalAnswered: number;

  @ApiProperty({
    description:
      'Total questions left unanswered across all completed attempts',
    example: 60,
  })
  totalUnanswered: number;

  @ApiProperty({
    description:
      'Accuracy percentage: (totalCorrect / totalAnswered) * 100. Returns 0 if no answers.',
    example: 74.29,
  })
  accuracyPercent: number;
}
