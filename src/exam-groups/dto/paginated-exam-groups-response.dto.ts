import { ExamGroupResponseDto } from './exam-group-response.dto';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';

export interface PaginatedExamGroupsResponseDto {
  data: ExamGroupResponseDto[];
  pagination: PaginationMetaDto;
}
