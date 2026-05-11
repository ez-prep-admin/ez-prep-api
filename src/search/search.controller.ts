import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResultsDto, SearchMetaDto } from './dto/search-result.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Global search across categories and exams',
    description:
      'Searches categories and exams collections in parallel for the given query string. ' +
      'Supports partial/prefix matching (e.g. "SS" matches "SSC"). ' +
      'Returns up to `limit` results per collection. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    schema: {
      example: {
        message: 'Search results for "SSC"',
        data: {
          categories: [
            {
              id: '64f1...',
              name: 'SSC',
              shortName: 'SSC',
              description: 'Staff Selection Commission',
            },
          ],
          exams: [
            {
              id: '64f2...',
              name: 'SSC CGL Tier 1',
              description: 'Combined Graduate Level Tier 1',
              category: { id: '64f1...', name: 'SSC', shortName: 'SSC' },
              examGroup: { id: '64f3...', name: 'CGL', shortName: 'CGL' },
              duration: 60,
              totalQuestions: 100,
              totalMarks: 200,
            },
          ],
        },
        meta: {
          query: 'SSC',
          categoriesCount: 1,
          examsCount: 1,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed — query is empty or exceeds max length',
  })
  async search(@Query() searchQueryDto: SearchQueryDto): Promise<{
    message: string;
    data: SearchResultsDto;
    meta: SearchMetaDto;
  }> {
    const { q, limit = 10 } = searchQueryDto;
    const data = await this.searchService.search(q, limit);

    return {
      message: `Search results for "${q}"`,
      data,
      meta: {
        query: q,
        categoriesCount: data.categories.length,
        examsCount: data.exams.length,
      },
    };
  }
}
