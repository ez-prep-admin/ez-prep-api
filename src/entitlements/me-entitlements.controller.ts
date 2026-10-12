import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { EntitlementListApiResponseDto } from './dto/entitlement-api-response.dto';
import { EntitlementsService } from './entitlements.service';

@ApiTags('me-entitlements')
@Controller('me/entitlements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class MeEntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List my entitlements',
    description:
      'Returns currently active entitlements by default. ' +
      'Pass includeInactive=true to include expired and revoked rows.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include expired/revoked entitlements',
  })
  @ApiOkResponse({ type: EntitlementListApiResponseDto })
  async listMine(
    @GetUser() user: UserResponseDto,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ): Promise<EntitlementListApiResponseDto> {
    const data = await this.entitlementsService.listByUser(user.id, {
      includeInactive,
    });
    return {
      message: 'Entitlements retrieved successfully',
      data,
    };
  }
}
