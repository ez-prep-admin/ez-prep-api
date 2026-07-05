import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportImageMetadataDto {
  @ApiProperty({ example: 'imports/507f1f77bcf86cd799439015/q1/stem.png' })
  key: string;

  @ApiProperty({ example: 'ez-prep-assets' })
  bucket: string;

  @ApiProperty({ example: 'ap-south-1' })
  region: string;

  @ApiPropertyOptional({ example: 'image/png' })
  contentType?: string;

  @ApiPropertyOptional({ example: 48291 })
  size?: number;

  @ApiPropertyOptional()
  lastModified?: Date;

  @ApiPropertyOptional({ example: 'https://example.com/presigned-url' })
  url?: string;
}

/** Mongo-ready question payload for import / failed-question correction. */
export class ImportQuestionPayloadDto {
  @ApiProperty({
    type: 'object',
    description: 'Question stem. `ml` is always empty for PDF imports.',
    example: {
      en: { text: 'Which of the following is correct?', image: null },
      ml: { text: null, image: null },
    },
    additionalProperties: true,
  })
  questionText: {
    en: { text?: string | null; image?: ImportImageMetadataDto | null };
    ml: { text: null; image: null };
  };

  @ApiProperty({ enum: ['text', 'image'] })
  optionType: 'text' | 'image';

  @ApiProperty({
    type: 'array',
    description: 'Exactly 4 options for NEET imports',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['text', 'image'] },
        en: { type: 'string', nullable: true },
        ml: { type: 'string', nullable: true },
        image: { type: 'object', nullable: true },
      },
    },
  })
  options: Array<{
    id: string;
    type: 'text' | 'image';
    en?: string | null;
    ml?: null;
    image?: ImportImageMetadataDto | null;
  }>;

  @ApiProperty({
    type: 'object',
    example: { en: 'Explanation text', ml: null, image: null },
    additionalProperties: true,
  })
  explanation: {
    en: string;
    ml?: null;
    image?: ImportImageMetadataDto | null;
  };

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Must match one of the option ids',
  })
  correctAnswer: string;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Subject ObjectId from the upload metadata',
  })
  subject: string;

  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'Topic ObjectId from the upload metadata',
  })
  topic: string;

  @ApiProperty({
    type: [String],
    example: ['507f1f77bcf86cd799439013'],
    description: 'Exam ObjectIds from the upload metadata',
  })
  exams: string[];

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficultyLevel: 'easy' | 'medium' | 'hard';

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiProperty({
    example: 'PDF_UPLOAD',
    enum: ['PDF_UPLOAD'],
    description: 'Applied automatically when omitted',
  })
  source?: 'PDF_UPLOAD';
}

export class ImportFailedQuestionResponseDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439021',
    description: 'MongoDB id of the saved question',
  })
  questionId: string;

  @ApiProperty({
    example: '507f1f77bcf86cd799439020',
    description: 'Failed question document id that was deleted',
  })
  failedQuestionId: string;
}
