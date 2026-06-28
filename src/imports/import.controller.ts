import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipTimeout } from '../common/decorators/skip-timeout.decorator';
import { ImportService } from './import.service';
import { PersistQuestionsDto } from './dto/persist-questions.dto';

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
      'Reads flip-test-25-parsed.json, sends matched questions to DeepSeek in batch, validates with Zod and business rules, maps to the Question schema shape, and returns Mongo-ready question objects.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Mongo-ready questions array plus per-question errors and processing stats.',
  })
  async debugEnrichSample() {
    return this.importService.enrichFlipTestSample();
  }

  @Post('questions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: PersistQuestionsDto })
  @ApiOperation({
    summary: 'Persist enriched questions to MongoDB',
    description:
      'Accepts the questions array from the enrich API (full enrich response also supported) and saves each question to the questions collection one by one.',
  })
  @ApiResponse({
    status: 201,
    description: 'Per-question save results with MongoDB ids and any failures.',
  })
  async persistQuestions(@Body() body: unknown) {
    return this.importService.persistQuestions(body);
  }
}
