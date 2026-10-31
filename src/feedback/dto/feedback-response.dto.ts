import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

export class FeedbackRatingsResponseDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  userInterface?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  questions?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  fullMockTests?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  topicWisePractice?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  easeOfUse?: number;
}

export class FeedbackCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: String })
  text: string | null;

  @ApiProperty({ type: FeedbackRatingsResponseDto })
  ratings: FeedbackRatingsResponseDto;

  @ApiProperty()
  createdAt: Date;
}

export class FeedbackAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class FeedbackListItemDto extends FeedbackCreatedDto {
  @ApiProperty({ type: FeedbackAuthorDto, nullable: true })
  user: FeedbackAuthorDto | null;
}

export class FeedbackCategorySummaryDto {
  @ApiProperty({ nullable: true, type: Number })
  average: number | null;

  @ApiProperty()
  count: number;
}

export class FeedbackSummaryDto {
  @ApiProperty()
  feedbackCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Mean of every stored star. Null when no ratings have been submitted.',
  })
  overall: number | null;

  @ApiProperty({ description: 'How many individual stars were submitted' })
  ratedCount: number;

  @ApiProperty({ type: FeedbackCategorySummaryDto })
  userInterface: FeedbackCategorySummaryDto;

  @ApiProperty({ type: FeedbackCategorySummaryDto })
  questions: FeedbackCategorySummaryDto;

  @ApiProperty({ type: FeedbackCategorySummaryDto })
  fullMockTests: FeedbackCategorySummaryDto;

  @ApiProperty({ type: FeedbackCategorySummaryDto })
  topicWisePractice: FeedbackCategorySummaryDto;

  @ApiProperty({ type: FeedbackCategorySummaryDto })
  easeOfUse: FeedbackCategorySummaryDto;
}

export class FeedbackListApiResponseDto {
  @ApiProperty({ example: 'Feedback retrieved successfully' })
  message: string;

  @ApiProperty({ type: [FeedbackListItemDto] })
  data: FeedbackListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
