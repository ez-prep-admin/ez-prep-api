import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipTimeout } from '../common/decorators/skip-timeout.decorator';
import { ImportService } from './import.service';

@ApiTags('imports')
@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('debug/parse')
  @ApiOperation({
    summary: 'Debug parse Flip test-25 markdown sample',
    description:
      'Parses the Mathpix markdown sample in test/test_data, saves the matched question blocks to flip-test-25-parsed.json, and returns the parse result.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Parsed document with matched questions, parser warnings, and saved JSON path.',
  })
  async debugParseSample() {
    return this.importService.parseFlipTestSample();
  }

  @Get('debug/enrich')
  @SkipTimeout()
  @ApiOperation({
    summary: 'Debug enrich parsed Flip test-25 questions with DeepSeek',
    description:
      'Reads flip-test-25-parsed.json, sends all matched questions to DeepSeek in a single batch (chunked for larger papers later), validates with Zod and business rules, maps to the Question schema shape, and returns Mongo-ready question objects.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of mapped questions plus per-question errors and processing stats.',
  })
  async debugEnrichSample() {
    return this.importService.enrichFlipTestSample();
  }
}
