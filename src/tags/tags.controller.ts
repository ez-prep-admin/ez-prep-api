import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new tag (Admin only)',
    description: `
    Creates a new tag with a unique combination of name, subject, and topic.
    Validates that both subject and topic exist before creation.
    
    Requires admin privileges.
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: TagResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or subject/topic not found',
  })
  @ApiConflictResponse({
    description: 'Tag with this name already exists for the subject and topic',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async create(
    @Body() createTagDto: CreateTagDto,
  ): Promise<{ message: string; data: TagResponseDto }> {
    const tag = await this.tagsService.create(createTagDto);
    return {
      message: 'Tag created successfully',
      data: tag,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tags with pagination',
    description: `
    Retrieves a paginated list of tags.
    Supports filtering by subject and/or topic.
    Sorted alphabetically by name.
    
    All query parameters are optional. Default: page=1, limit=10
    `,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (minimum: 1, maximum: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    type: String,
    description: 'Filter by subject ID',
    example: '64f123456789abcdef123456',
  })
  @ApiQuery({
    name: 'topicId',
    required: false,
    type: String,
    description: 'Filter by topic ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tags retrieved successfully' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TagResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 45 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
  ): Promise<{
    message: string;
    data: TagResponseDto[];
    pagination: PaginationMetaDto;
  }> {
    const result = await this.tagsService.findAll(
      page,
      limit,
      subjectId,
      topicId,
    );
    return {
      message: 'Tags retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single tag by ID',
    description: `
    Retrieves detailed information about a specific tag.
    Returns 404 if the tag doesn't exist or has been soft-deleted.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Tag retrieved successfully',
    type: TagResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<{ message: string; data: TagResponseDto }> {
    const tag = await this.tagsService.findOne(id);
    return {
      message: 'Tag retrieved successfully',
      data: tag,
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a tag (Admin only)',
    description: `
    Updates tag information.
    Validates subject/topic existence if they are being updated.
    Checks for duplicate name if name, subject, or topic is being updated.
    
    Requires admin privileges.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Tag updated successfully',
    type: TagResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or subject/topic not found',
  })
  @ApiConflictResponse({
    description: 'Tag with this name already exists for the subject and topic',
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<{ message: string; data: TagResponseDto }> {
    const tag = await this.tagsService.update(id, updateTagDto);
    return {
      message: 'Tag updated successfully',
      data: tag,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a tag (Admin only)',
    description: `
    Soft deletes a tag (marks as deleted but preserves data).
    
    Requires admin privileges.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    example: '64f123456789abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Tag deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tag deleted successfully' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required or insufficient privileges',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    const result = await this.tagsService.remove(id);
    return result;
  }
}
