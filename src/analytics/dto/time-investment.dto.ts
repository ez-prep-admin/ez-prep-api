import { ApiProperty } from '@nestjs/swagger';

export class TimeInvestmentDto {
  @ApiProperty({
    description:
      'Total minutes invested across all completed/expired attempts (rounded to 1 decimal)',
    example: 340.5,
  })
  totalMinutes: number;

  @ApiProperty({
    description:
      'Average minutes spent per completed/expired attempt (rounded to 1 decimal)',
    example: 14.2,
  })
  averageMinutesPerAttempt: number;
}
