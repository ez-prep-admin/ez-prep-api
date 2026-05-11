import { ApiProperty } from '@nestjs/swagger';

export class SubjectPerformanceDto {
  @ApiProperty({
    description: 'Subject ObjectId as string',
    example: '64f123456789abcdef123456',
  })
  subjectId: string;

  @ApiProperty({
    description: 'Subject name',
    example: 'Mathematics',
  })
  subjectName: string;

  @ApiProperty({
    description: 'Number of completed/expired attempts for this subject',
    example: 8,
  })
  attemptCount: number;

  @ApiProperty({
    description: 'Average score percentage for this subject',
    example: 68.75,
  })
  averageScorePercent: number;
}

export class ExamPerformanceDto {
  @ApiProperty({
    description: 'Exam ObjectId as string',
    example: '64f123456789abcdef654321',
  })
  examId: string;

  @ApiProperty({
    description: 'Exam name',
    example: 'UPSC Civil Services',
  })
  examName: string;

  @ApiProperty({
    description: 'Number of completed/expired attempts for this exam',
    example: 12,
  })
  attemptCount: number;

  @ApiProperty({
    description: 'Average score percentage for this exam',
    example: 74.17,
  })
  averageScorePercent: number;
}
