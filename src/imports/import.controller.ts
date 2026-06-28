import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ImportService } from './import.service';

@ApiTags('imports')
@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('debug/parse')
  @ApiOperation({
    summary: 'Debug parse Flip test-25 markdown sample',
    description:
      'Parses the Mathpix markdown sample in test/test_data and returns matched question blocks for Phase 1 validation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Parsed document with matched questions and parser warnings.',
  })
  async debugParseSample() {
    return this.importService.parseFlipTestSample();
  }
}
