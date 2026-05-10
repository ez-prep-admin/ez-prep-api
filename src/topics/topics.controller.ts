import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicResponseDto } from './dto/topic-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new topic (Admin only)',
    description:
      'Creates a new topic like Ratio & Proportion, Linear Algebra, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Topic created successfully',
    type: TopicResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Topic already exists' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async create(@Body() createTopicDto: CreateTopicDto): Promise<{
    message: string;
    data: TopicResponseDto;
  }> {
    const topic = await this.topicsService.create(createTopicDto);
    return {
      message: 'Topic created successfully',
      data: topic,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all topics',
    description: 'Retrieves all topics. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Topics retrieved successfully',
    type: [TopicResponseDto],
  })
  async findAll(): Promise<{
    message: string;
    data: TopicResponseDto[];
    count: number;
  }> {
    const topics = await this.topicsService.findAll();
    return {
      message: 'Topics retrieved successfully',
      data: topics,
      count: topics.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get topic by ID',
    description: 'Retrieves a single topic by its ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Topic retrieved successfully',
    type: TopicResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: TopicResponseDto;
  }> {
    const topic = await this.topicsService.findOne(id);
    return {
      message: 'Topic retrieved successfully',
      data: topic,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update topic (Admin only)',
    description: 'Updates an existing topic',
  })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Topic updated successfully',
    type: TopicResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Topic name already exists' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async update(
    @Param('id') id: string,
    @Body() updateTopicDto: UpdateTopicDto,
  ): Promise<{
    message: string;
    data: TopicResponseDto;
  }> {
    const topic = await this.topicsService.update(id, updateTopicDto);
    return {
      message: 'Topic updated successfully',
      data: topic,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete topic (Admin only)',
    description: 'Soft deletes a topic',
  })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Topic deleted successfully',
    type: TopicResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiUnauthorizedResponse({ description: 'Admin privileges required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: TopicResponseDto;
  }> {
    const topic = await this.topicsService.remove(id);
    return {
      message: 'Topic deleted successfully',
      data: topic,
    };
  }
}
