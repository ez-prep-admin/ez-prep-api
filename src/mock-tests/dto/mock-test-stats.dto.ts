import { ApiProperty } from '@nestjs/swagger';

/**
 * Mock test statistics DTO
 */
export class MockTestStatsDto {
  @ApiProperty({
    description: 'Total number of mock tests',
    example: 100,
  })
  totalTests: number;

  @ApiProperty({
    description: 'Number of active tests',
    example: 95,
  })
  activeTests: number;

  @ApiProperty({
    description: 'Number of inactive tests',
    example: 5,
  })
  inactiveTests: number;

  @ApiProperty({
    description: 'Tests grouped by generation mode',
    example: { static: 80, dynamic: 20 },
  })
  byGenerationMode: {
    static: number;
    dynamic: number;
  };

  @ApiProperty({
    description: 'Total questions by difficulty level',
    example: { easy: 500, medium: 300, hard: 200 },
  })
  totalQuestionsByDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
}
