import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PdfUploadFileValidator } from './validators/pdf-upload-file.validator';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipTimeout } from '../common/decorators/skip-timeout.decorator';
import { ImportService } from './import.service';
import {
  CachedEnrichmentResponseDto,
  FailedQuestionListItemDto,
  FailedQuestionsListResponseDto,
  ImportFailedQuestionDto,
  ImportFailedQuestionResponseDto,
  DeleteFailedQuestionResponseDto,
  PersistQuestionsResponseDto,
} from './dto/persist-questions.dto';
import {
  UploadQuestionPdfDto,
  UploadQuestionPdfResponseDto,
} from './dto/upload-question-pdf.dto';
import {
  ParseQuestionPdfDto,
  GetUploadDetailsResponseDto,
  ListUploadsQueryDto,
  UploadsListResponseDto,
  StartParsePdfUploadResponseDto,
} from './dto/parse-question-pdf.dto';
import {
  EnrichQuestionsDto,
  EnrichQuestionsResponseDto,
  StartEnrichUploadResponseDto,
} from './dto/enrich-questions.dto';
import { ParseMarkdownResponseDto } from './dto/parse-markdown.dto';

@ApiTags('imports')
@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('questions/:uploadId')
  @HttpCode(HttpStatus.CREATED)
  @SkipTimeout()
  @ApiOperation({
    summary: 'Import cached enriched questions to MongoDB',
    description:
      'Loads successful questions cached on the upload document (from POST /imports/enrich/:uploadId) ' +
      'and inserts them into the questions collection one by one. ' +
      'Each successfully saved question is removed from the upload cache immediately so retries are safe. ' +
      'On full success, sets upload status to `completed` and clears remaining cached enrichment/parse data.',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'Upload ID from question_uploads with status `enriched`',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiResponse({
    status: 201,
    description:
      'Per-question save results with MongoDB ids. Upload status becomes `completed` when all questions save.',
    type: PersistQuestionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Upload not enriched or no cached questions',
  })
  @ApiResponse({
    status: 404,
    description: 'Upload not found',
  })
  async persistQuestions(
    @Param('uploadId') uploadId: string,
  ): Promise<{ message: string; data: PersistQuestionsResponseDto }> {
    const result = await this.importService.persistQuestions(uploadId);

    return {
      message: result.summary,
      data: result,
    };
  }

  @Post('upload-pdf')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a question paper PDF',
    description:
      'Upload a PDF file containing question paper along with metadata (subject, topic, exams). ' +
      'The PDF is stored in AWS S3 and tracked in the database for later processing.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to upload (max 50MB)',
        },
        title: {
          type: 'string',
          description:
            'Title/name for the PDF (optional). If not provided, a UUID will be generated.',
          example: 'NEET 2023 Physics Paper',
        },
        subjectId: {
          type: 'string',
          description: 'Subject ID (MongoDB ObjectId)',
          example: '507f1f77bcf86cd799439011',
        },
        topicId: {
          type: 'string',
          description: 'Topic ID (MongoDB ObjectId)',
          example: '507f1f77bcf86cd799439012',
        },
        examIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Exam IDs',
          example: ['507f1f77bcf86cd799439013'],
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata as key-value pairs',
          example: { examYear: '2023', testSeries: 'NEET Mock Test' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'PDF uploaded successfully',
    type: UploadQuestionPdfResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or validation error',
  })
  async uploadQuestionPdf(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new PdfUploadFileValidator({}),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadQuestionPdfDto,
  ): Promise<{ message: string; data: UploadQuestionPdfResponseDto }> {
    // TODO: Get userId from authentication context when auth is implemented
    // For now, using undefined (will be stored as 'anonymous')
    const userId = undefined;

    const result = await this.importService.uploadQuestionPdf(
      file,
      dto,
      userId,
    );

    return {
      message: 'Question paper PDF uploaded successfully',
      data: result,
    };
  }

  @Post('parse-pdf/:uploadId')
  @HttpCode(HttpStatus.ACCEPTED)
  @SkipTimeout() // Mathpix conversion can take several minutes
  @ApiOperation({
    summary: 'Start PDF parsing using Mathpix (async)',
    description:
      'Accepts the parse job immediately (202) and runs Mathpix OCR in the background. ' +
      'Poll GET /imports/uploads/:uploadId until status is `parsed` or `failed`. ' +
      'This process can take 1-5 minutes depending on the PDF size and complexity.',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'Upload ID from the upload-pdf endpoint',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiBody({
    type: ParseQuestionPdfDto,
    required: false,
  })
  @ApiResponse({
    status: 202,
    description: 'Parse job accepted; poll upload status for completion',
    type: StartParsePdfUploadResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Upload is already being parsed',
  })
  async parseQuestionPdf(
    @Param('uploadId') uploadId: string,
    @Body() dto: ParseQuestionPdfDto,
  ): Promise<{ message: string; data: StartParsePdfUploadResponseDto }> {
    const result = await this.importService.startParsePdfUpload(uploadId, dto);

    return {
      message: result.message,
      data: result,
    };
  }

  @Post('parse-markdown/:uploadId')
  @HttpCode(HttpStatus.OK)
  @SkipTimeout()
  @ApiOperation({
    summary: 'Parse markdown into matched question blocks',
    description:
      'Fetches Mathpix markdown from S3, detects document structure (LLM), splits into questions/solutions, and returns a chunking preview for the enrich step.',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'Upload ID with status parsed',
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown parsed into matched questions',
    type: ParseMarkdownResponseDto,
  })
  async parseUploadMarkdown(
    @Param('uploadId') uploadId: string,
  ): Promise<{ message: string; data: ParseMarkdownResponseDto }> {
    const result = await this.importService.parseUploadMarkdown(uploadId);

    return {
      message: 'Markdown parsed successfully',
      data: result,
    };
  }

  @Post('enrich/:uploadId')
  @HttpCode(HttpStatus.ACCEPTED)
  @SkipTimeout()
  @ApiOperation({
    summary: 'Start enrichment for an upload (async)',
    description:
      'Accepts the enrichment job immediately (202) and runs parse + chunk + DeepSeek in the background. ' +
      'Poll GET /imports/uploads/:uploadId until status is `enriched` or `failed`. ' +
      'Successful questions are cached on the upload document. Rejected questions are stored in `failed_questions`.',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'Upload ID with markdown available in S3',
  })
  @ApiBody({ type: EnrichQuestionsDto, required: false })
  @ApiResponse({
    status: 202,
    description: 'Enrichment job accepted; poll upload status for completion',
    type: StartEnrichUploadResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Upload is already being enriched',
  })
  async enrichUpload(
    @Param('uploadId') uploadId: string,
    @Body() dto: EnrichQuestionsDto,
  ): Promise<{ message: string; data: StartEnrichUploadResponseDto }> {
    const result = await this.importService.startEnrichUpload(uploadId, dto);

    return {
      message: result.message,
      data: result,
    };
  }

  @Post('enrich')
  @HttpCode(HttpStatus.OK)
  @SkipTimeout()
  @ApiOperation({
    summary: 'Enrich matched questions with DeepSeek',
    description:
      'Accepts matchedQuestions from parse-markdown and runs adaptive chunking + DeepSeek enrichment. Use when you want to inspect parse output before calling the LLM.',
  })
  @ApiBody({ type: EnrichQuestionsDto })
  @ApiResponse({
    status: 200,
    description: 'Enriched questions ready for persistence',
    type: EnrichQuestionsResponseDto,
  })
  async enrichQuestions(@Body() dto: EnrichQuestionsDto): Promise<{
    message: string;
    data: EnrichQuestionsResponseDto;
  }> {
    const result = await this.importService.enrichQuestions(dto);

    return {
      message: result.summary,
      data: result,
    };
  }

  @Get('uploads/:uploadId/enrichment')
  @ApiOperation({
    summary: 'Get cached enrichment result for an upload',
    description:
      'Returns the stored LLM enrichment output without re-running DeepSeek. Use after POST /imports/enrich/:uploadId.',
  })
  @ApiParam({ name: 'uploadId', description: 'Upload ID' })
  @ApiResponse({
    status: 200,
    description: 'Cached enrichment result',
    type: CachedEnrichmentResponseDto,
  })
  async getCachedEnrichment(@Param('uploadId') uploadId: string): Promise<{
    message: string;
    data: CachedEnrichmentResponseDto;
  }> {
    const result = await this.importService.getCachedEnrichment(uploadId);

    return {
      message: 'Cached enrichment retrieved successfully',
      data: result,
    };
  }

  @Get('failed-questions')
  @ApiOperation({
    summary: 'List all failed questions (paginated)',
    description:
      'Returns paginated documents from the failed_questions collection. Each item includes ' +
      'failure metadata, source markdown (`matchedQuestion`), a stored partial payload (`questionDraft` when available), ' +
      'and a form-ready `question` object with subject/topic/exam ids for the admin edit UI.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated failed questions',
    type: FailedQuestionsListResponseDto,
  })
  async listFailedQuestions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ message: string; data: FailedQuestionsListResponseDto }> {
    const result = await this.importService.listFailedQuestions(
      page ?? 1,
      limit ?? 10,
    );

    return {
      message: 'Failed questions retrieved successfully',
      data: result,
    };
  }

  @Get('failed-questions/:failedQuestionId')
  @ApiOperation({
    summary: 'Get a single failed question for editing',
    description:
      'Loads one failed_questions document with the same shape as the list endpoint, ' +
      'including the form-ready `question` payload for the admin edit screen.',
  })
  @ApiParam({
    name: 'failedQuestionId',
    description: 'Failed question document ID',
    example: '507f1f77bcf86cd799439020',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed question retrieved successfully',
    type: FailedQuestionListItemDto,
  })
  @ApiResponse({ status: 404, description: 'Failed question not found' })
  async getFailedQuestion(
    @Param('failedQuestionId') failedQuestionId: string,
  ): Promise<{ message: string; data: FailedQuestionListItemDto }> {
    const result = await this.importService.getFailedQuestion(failedQuestionId);

    return {
      message: 'Failed question retrieved successfully',
      data: result,
    };
  }

  @Post('failed-questions/:failedQuestionId/import')
  @HttpCode(HttpStatus.CREATED)
  @SkipTimeout()
  @ApiOperation({
    summary: 'Import a corrected failed question',
    description:
      'Validates the corrected question payload (same rules as POST /imports/questions/:uploadId), ' +
      'inserts it into the questions collection, then deletes the failed_questions entry. ' +
      'Send the full corrected question in the request body; identify the failed record via the URL path parameter.',
  })
  @ApiParam({
    name: 'failedQuestionId',
    description:
      'Failed question document ID to delete after successful import',
    example: '507f1f77bcf86cd799439020',
  })
  @ApiBody({ type: ImportFailedQuestionDto })
  @ApiResponse({
    status: 201,
    description: 'Corrected question saved and failed entry removed',
    type: ImportFailedQuestionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (schema, difficulty, options, subject/topic/exam references, etc.)',
  })
  @ApiResponse({ status: 404, description: 'Failed question not found' })
  async importFailedQuestion(
    @Param('failedQuestionId') failedQuestionId: string,
    @Body() body: ImportFailedQuestionDto,
  ): Promise<{
    message: string;
    data: ImportFailedQuestionResponseDto;
  }> {
    const result = await this.importService.importFailedQuestion(
      failedQuestionId,
      body.question,
    );

    return {
      message: 'Failed question imported successfully',
      data: result,
    };
  }

  @Delete('failed-questions/:failedQuestionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a failed question',
    description:
      'Permanently deletes a single document from the failed_questions collection by its MongoDB id. ' +
      'Use when an admin dismisses a failed question without importing a corrected version.',
  })
  @ApiParam({
    name: 'failedQuestionId',
    description: 'Failed question document MongoDB id',
    example: '507f1f77bcf86cd799439020',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed question deleted successfully',
    type: DeleteFailedQuestionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid failed question ID' })
  @ApiResponse({ status: 404, description: 'Failed question not found' })
  async deleteFailedQuestion(
    @Param('failedQuestionId') failedQuestionId: string,
  ): Promise<{
    message: string;
    data: DeleteFailedQuestionResponseDto;
  }> {
    const result =
      await this.importService.deleteFailedQuestion(failedQuestionId);

    return {
      message: 'Failed question deleted successfully',
      data: result,
    };
  }

  @Get('uploads/:uploadId')
  @ApiOperation({
    summary: 'Get upload details',
    description: 'Retrieve details of a previously uploaded question paper PDF',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'Upload ID',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload details retrieved successfully',
    type: GetUploadDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload not found',
  })
  async getUploadDetails(
    @Param('uploadId') uploadId: string,
  ): Promise<{ message: string; data: GetUploadDetailsResponseDto }> {
    const result = await this.importService.getUploadDetails(uploadId);

    return {
      message: 'Upload details retrieved successfully',
      data: result,
    };
  }

  @Get('uploads')
  @ApiOperation({
    summary: 'List uploaded PDFs',
    description:
      'Get a paginated list of uploaded question paper PDFs. ' +
      'Supports filtering by subjectId, topicId, and status, plus case-insensitive filename search. ' +
      'Each item includes its `status`, so the frontend can categorize ' +
      '(e.g. parsed vs unparsed) client-side without separate arrays.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of uploads retrieved successfully',
    type: UploadsListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async listUploads(@Query() query: ListUploadsQueryDto): Promise<{
    message: string;
    data: UploadsListResponseDto;
  }> {
    const result = await this.importService.listUploads(query);

    return {
      message: 'Uploads retrieved successfully',
      data: result,
    };
  }
}
