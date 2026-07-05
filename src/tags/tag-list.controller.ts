import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { TagResponseDto } from './dto/tag-response.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';

@ApiTags('tags')
@Controller('tag')
export class TagListController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('list')
  @ApiOperation({
    summary: 'List tags by subject and topic',
    description:
      'Returns tags filtered by subject and topic. Public endpoint for dropdowns. Defaults: page=1, limit=100',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (minimum: 1, maximum: 100)',
    example: 100,
  })
  @ApiQuery({
    name: 'subject',
    required: true,
    type: String,
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  @ApiQuery({
    name: 'topic',
    required: true,
    type: String,
    description: 'Topic ID',
    example: '64f123456789abcdef123456',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum: 1)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'subject and topic query parameters are required',
  })
  async list(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('subject') subject?: string,
    @Query('topic') topic?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
  ): Promise<{
    message: string;
    data: TagResponseDto[];
    pagination: PaginationMetaDto;
  }> {
    if (!subject?.trim() || !topic?.trim()) {
      throw new BadRequestException(
        'subject and topic query parameters are required',
      );
    }

    const result = await this.tagsService.findAll(page, limit, subject, topic);
    return {
      message: 'Tags retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
