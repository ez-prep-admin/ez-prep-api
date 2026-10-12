import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateInstanceConfigDto } from './dto/create-instance-config.dto';
import { InstanceConfigResponseDto } from './dto/instance-config-response.dto';
import { UpdateInstanceConfigDto } from './dto/update-instance-config.dto';
import { InstanceConfigService } from './instance-config.service';

@ApiTags('instance-config')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Admin privileges required' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('instance-config')
export class InstanceConfigController {
  constructor(private readonly instanceConfigService: InstanceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get this deployment instance configuration',
    description:
      'Returns the singleton branding document for this API instance. data is null until an admin creates it.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved, or not created yet',
    type: InstanceConfigResponseDto,
  })
  async get(): Promise<{
    message: string;
    data: InstanceConfigResponseDto | null;
  }> {
    const data = await this.instanceConfigService.get();
    return {
      message: data
        ? 'Instance configuration retrieved successfully'
        : 'Instance configuration has not been set',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create this deployment instance configuration',
    description:
      'One-time setup. Stores the display name and optional logo and favicon for this instance. Add new fields to the schema when the product needs them.',
  })
  @ApiResponse({
    status: 201,
    description: 'Instance configuration created',
    type: InstanceConfigResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Instance configuration already exists' })
  async create(@Body() dto: CreateInstanceConfigDto): Promise<{
    message: string;
    data: InstanceConfigResponseDto;
  }> {
    const data = await this.instanceConfigService.create(dto);
    return {
      message: 'Instance configuration created successfully',
      data,
    };
  }

  @Put()
  @ApiOperation({
    summary: 'Update this deployment instance configuration',
    description:
      'Changes only the fields you send. Send null or an empty string to clear logoUrl or faviconUrl. Nested seller and taxConfig keys update on their own. A new GSTIN is stored as sent, with no checksum or state-prefix check.',
  })
  @ApiResponse({
    status: 200,
    description: 'Instance configuration updated',
    type: InstanceConfigResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or no fields given',
  })
  @ApiNotFoundResponse({
    description: 'Instance configuration has not been created',
  })
  async update(@Body() dto: UpdateInstanceConfigDto): Promise<{
    message: string;
    data: InstanceConfigResponseDto;
  }> {
    const data = await this.instanceConfigService.update(dto);
    return {
      message: 'Instance configuration updated successfully',
      data,
    };
  }
}
