import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentAffairsService } from './current-affairs.service';
import { CreateCurrentAffairDto } from './dto/create-current-affair.dto';
import { CurrentAffairResponseDto } from './dto/current-affair-response.dto';
import {
  CurrentAffairApiResponseDto,
  CurrentAffairsListApiResponseDto,
} from './dto/paginated-current-affairs-response.dto';
import { UpdateCurrentAffairDto } from './dto/update-current-affair.dto';

@ApiTags('current-affairs')
@Controller('current-affairs')
export class CurrentAffairsController {
  constructor(private readonly currentAffairsService: CurrentAffairsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a current affairs item (Admin only)',
    description: `
Creates **one** current affairs document tagged to a calendar \`date\` (\`YYYY-MM-DD\`).

- Each item is its own MongoDB document. Items for the same day are grouped by \`date\`, not nested in a parent "day" object.
- \`sortOrder\` is assigned automatically (\`max + 1\` for that date, or \`0\` if first).
- Optional \`image\` is S3 metadata from \`POST /api/v1/files/upload\`. Reads return a short-lived \`imageUrl\`.
- \`date\` is required from the client so the stored day never silently shifts across timezones.

Requires admin JWT.
    `,
  })
  @ApiBody({ type: CreateCurrentAffairDto })
  @ApiCreatedResponse({
    description: 'Current affair created successfully',
    type: CurrentAffairApiResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed (missing title/description/date, invalid calendar date such as 2026-02-31, or invalid image metadata)',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT',
  })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async create(@Body() dto: CreateCurrentAffairDto): Promise<{
    message: string;
    data: CurrentAffairResponseDto;
  }> {
    const item = await this.currentAffairsService.create(dto);
    return {
      message: 'Current affair created successfully',
      data: item,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List current affairs items',
    description: `
Paginated public list. Soft-deleted items are never returned.

**User-facing app (one round trip for a day):**
\`GET /api/v1/current-affairs?date=2026-08-14&activeOnly=true&limit=100\`

**Admin:** omit \`activeOnly\` to include inactive items; pass \`date\` from the single-date picker. Optional \`search\` uses a text index on title and description.

When \`date\` is set, results are ordered by \`sortOrder\` then \`createdAt\`. Otherwise by \`date\` descending, then \`sortOrder\`.

\`page\` is clamped to ≥ 1. \`limit\` is clamped to 1–100.
    `,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (minimum 1). Default 1.',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (1–100). Default 10. Use 100 for a full day in the user app.',
    example: 10,
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description:
      'Single calendar date (YYYY-MM-DD). Not a range. Invalid dates (wrong format or 2026-02-31) return 400.',
    example: '2026-08-14',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Full-text search on title and description',
    example: 'ISRO satellite',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description:
      'When true, only `isActive` items are returned. Use true for the user-facing app.',
    example: true,
  })
  @ApiOkResponse({
    description: 'Current affairs retrieved successfully',
    type: CurrentAffairsListApiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid `date` query (must be a real YYYY-MM-DD calendar date)',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('date') date?: string,
    @Query('search') search?: string,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe)
    activeOnly?: boolean,
  ): Promise<CurrentAffairsListApiResponseDto> {
    const result = await this.currentAffairsService.findAll(
      page,
      limit,
      date,
      search,
      activeOnly,
    );

    return {
      message: date
        ? `Current affairs for ${date} retrieved successfully`
        : 'Current affairs retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a current affairs item by ID',
    description: `
Public endpoint. Returns a single non-deleted item including stored image metadata and a fresh signed \`imageUrl\`.

Returns 404 if the id does not exist or the item was soft-deleted.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Current affair MongoDB ObjectId',
    example: '64f123456789abcdef123456',
  })
  @ApiOkResponse({
    description: 'Current affair retrieved successfully',
    type: CurrentAffairApiResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Current affair not found' })
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    data: CurrentAffairResponseDto;
  }> {
    const item = await this.currentAffairsService.findOne(id);
    return {
      message: 'Current affair retrieved successfully',
      data: item,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a current affairs item (Admin only)',
    description: `
Partial update. Only provided fields are changed.

- Changing \`date\` moves the item to another calendar day. If \`sortOrder\` is omitted, it is appended to that day.
- Send \`image: null\` to remove an existing image. Omit \`image\` to leave it unchanged. Send new S3 metadata to replace it.
- Set \`isActive: false\` to hide the item from user-facing \`activeOnly=true\` lists without deleting it.

Requires admin JWT.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Current affair MongoDB ObjectId',
    example: '64f123456789abcdef123456',
  })
  @ApiBody({ type: UpdateCurrentAffairDto })
  @ApiOkResponse({
    description: 'Current affair updated successfully',
    type: CurrentAffairApiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid calendar date',
  })
  @ApiNotFoundResponse({ description: 'Current affair not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCurrentAffairDto,
  ): Promise<{
    message: string;
    data: CurrentAffairResponseDto;
  }> {
    const item = await this.currentAffairsService.update(id, dto);
    return {
      message: 'Current affair updated successfully',
      data: item,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Soft delete a current affairs item (Admin only)',
    description: `
Marks the item as deleted (\`isDeleted: true\`, \`isActive: false\`). It is excluded from all subsequent finds.

The document is retained for audit; this is not a hard delete.

Requires admin JWT.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Current affair MongoDB ObjectId',
    example: '64f123456789abcdef123456',
  })
  @ApiOkResponse({
    description: 'Current affair deleted successfully',
    type: CurrentAffairApiResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Current affair not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async remove(@Param('id') id: string): Promise<{
    message: string;
    data: CurrentAffairResponseDto;
  }> {
    const item = await this.currentAffairsService.remove(id);
    return {
      message: 'Current affair deleted successfully',
      data: item,
    };
  }
}
