import { ApiProperty } from '@nestjs/swagger';
import { DraftResponseDto } from './draft-response.dto';

export class PublishDraftResultDto {
  @ApiProperty({
    description: 'ID of the published FULL_EXAM mock test in mocktests',
    example: '64f123456789abcdef123456',
  })
  mockTestId: string;

  @ApiProperty({
    description:
      'Draft after publish (status PUBLISHED, publishedMockTestId set)',
    type: DraftResponseDto,
  })
  draft: DraftResponseDto;
}
