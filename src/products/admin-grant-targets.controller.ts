import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { GrantTargetsApiResponseDto } from './dto/grant-target.dto';
import { GrantTargetsService } from './grant-targets.service';

@ApiTags('admin-grant-targets')
@Controller('admin/grant-targets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminGrantTargetsController {
  constructor(private readonly grantTargetsService: GrantTargetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Search grant targets (Admin)',
    description:
      'Typeahead for product grants and admin entitlements. ' +
      'Matches exam group name or short name, exam name, or mock-test title and description. ' +
      'Mock-test search also treats a leading topic, sprint, or full word as a paper-kind filter. ' +
      'Pass ids to resolve labels for targets that are already selected.',
  })
  @ApiQuery({ name: 'scopeType', required: true, enum: EntitlementScopeType })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '1–50, default 20',
    example: 20,
  })
  @ApiQuery({
    name: 'ids',
    required: false,
    description:
      'Comma-separated ids to resolve (max 100). Ignores search and paging.',
  })
  @ApiOkResponse({ type: GrantTargetsApiResponseDto })
  async search(
    @Query('scopeType') scopeType?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('ids') ids?: string,
  ): Promise<GrantTargetsApiResponseDto> {
    const result = await this.grantTargetsService.search({
      scopeType,
      search,
      page,
      limit,
      ids,
    });
    return {
      message: 'Grant targets retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }
}
