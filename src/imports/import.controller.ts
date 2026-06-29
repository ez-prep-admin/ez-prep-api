import {
  Body,
  Controller,
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
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { PersistQuestionsDto } from './dto/persist-questions.dto';
import {
  UploadQuestionPdfDto,
  UploadQuestionPdfResponseDto,
} from './dto/upload-question-pdf.dto';
import {
  ParseQuestionPdfDto,
  ParseQuestionPdfResponseDto,
  GetUploadDetailsResponseDto,
  CategorizedUploadsResponseDto,
} from './dto/parse-question-pdf.dto';

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

  @Post('upload-pdf')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a question paper PDF',
    description:
      'Upload a PDF file containing question paper along with metadata (subject, topic, exams, difficulty). ' +
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
          description: 'Title/name for the PDF (optional). If not provided, a UUID will be generated.',
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
        difficultyLevel: {
          type: 'string',
          enum: ['easy', 'medium', 'hard'],
          description: 'Difficulty level',
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
          new FileTypeValidator({ fileType: 'application/pdf' }),
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

    // Parse examIds if provided as string (from form-data)
    if (dto.examIds && typeof dto.examIds === 'string') {
      try {
        dto.examIds = JSON.parse(dto.examIds as any);
      } catch {
        throw new BadRequestException('Invalid examIds format. Must be a JSON array.');
      }
    }

    // Parse metadata if provided as string (from form-data)
    if (dto.metadata && typeof dto.metadata === 'string') {
      try {
        dto.metadata = JSON.parse(dto.metadata as any);
      } catch {
        throw new BadRequestException('Invalid metadata format. Must be a JSON object.');
      }
    }

    const result = await this.importService.uploadQuestionPdf(file, dto, userId);

    return {
      message: 'Question paper PDF uploaded successfully',
      data: result,
    };
  }

  @Post('parse-pdf/:uploadId')
  @HttpCode(HttpStatus.OK)
  @SkipTimeout() // Mathpix conversion can take several minutes
  @ApiOperation({
    summary: 'Parse an uploaded PDF using Mathpix',
    description:
      'Convert a previously uploaded PDF to Markdown format using Mathpix OCR API. ' +
      'This process can take 1-5 minutes depending on the PDF size and complexity. ' +
      'The markdown content is saved to S3 and the S3 key is returned in the response. ' +
      'The full markdown is also returned in the immediate response for convenience.',
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
    status: 200,
    description: 'PDF parsed successfully',
    type: ParseQuestionPdfResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Mathpix conversion failed',
  })
  async parseQuestionPdf(
    @Param('uploadId') uploadId: string,
    @Body() dto: ParseQuestionPdfDto,
  ): Promise<{ message: string; data: ParseQuestionPdfResponseDto }> {
    const result = await this.importService.parseQuestionPdf(uploadId, dto);

    return {
      message: 'PDF parsed successfully',
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
    summary: 'List uploaded PDFs (categorized)',
    description:
      'Get a categorized list of uploaded question paper PDFs. ' +
      'Returns two arrays: one with PDFs already converted to markdown (parsed), ' +
      'and another with PDFs not yet converted (unparsed).',
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
    description: 'Categorized list of uploads retrieved successfully',
    type: CategorizedUploadsResponseDto,
  })
  async listUploads(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    message: string;
    data: CategorizedUploadsResponseDto;
  }> {
    const result = await this.importService.listUploads(
      page ?? 1,
      limit ?? 10,
    );

    return {
      message: 'Uploads retrieved successfully',
      data: result,
    };
  }
}
