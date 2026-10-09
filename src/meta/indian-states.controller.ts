import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { INDIAN_STATES } from '../common/commerce/indian-states';

@ApiTags('meta')
@Controller('meta')
export class IndianStatesController {
  @Get('indian-states')
  @ApiOperation({
    summary: 'List Indian GST state and union territory codes',
    description:
      'Canonical list for checkout place of supply. Frontends must not keep a parallel table.',
  })
  @ApiOkResponse({ description: 'State code and name pairs' })
  list() {
    return {
      message: 'Indian states retrieved successfully',
      data: INDIAN_STATES.map(state => ({
        code: state.code,
        name: state.name,
      })),
    };
  }
}
