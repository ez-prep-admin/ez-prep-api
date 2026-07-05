import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  MathpixProcessOptions,
  MathpixProcessRequest,
  MathpixProcessResponse,
  MathpixStatusResponse,
  MathpixConversionResult,
  MathpixPollingOptions,
  MathpixStatus,
} from './mathpix.types';

/**
 * Mathpix API Service
 * Handles PDF to Markdown conversion using Mathpix API
 */
@Injectable()
export class MathpixService {
  private readonly logger = new Logger(MathpixService.name);
  private readonly client: AxiosInstance;
  private readonly appId: string;
  private readonly appKey: string;
  private readonly baseUrl = 'https://api.mathpix.com/v3';

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('MATHPIX_APP_ID') ?? '';
    this.appKey = this.configService.get<string>('MATHPIX_APP_KEY') ?? '';

    if (!this.appId || !this.appKey) {
      this.logger.warn(
        '[mathpix] ⚠️  Mathpix credentials not configured. Set MATHPIX_APP_ID and MATHPIX_APP_KEY in .env file.',
      );
    }

    // Initialize Axios client with Mathpix credentials
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        app_id: this.appId,
        app_key: this.appKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds per request
    });

    this.logger.log('[mathpix] Service initialized');
  }

  /**
   * Convert PDF to Markdown using Mathpix API
   * This is a high-level method that handles the entire conversion process:
   * 1. Submit PDF for processing
   * 2. Poll for completion
   * 3. Return markdown result
   *
   * @param pdfUrl Public URL of the PDF file (must be accessible to Mathpix)
   * @param options Processing options
   * @param pollingOptions Polling configuration
   * @returns Conversion result with markdown content
   */
  async convertPdfToMarkdown(
    pdfUrl: string,
    options: MathpixProcessOptions = {},
    pollingOptions: MathpixPollingOptions = {},
  ): Promise<MathpixConversionResult> {
    const startTime = Date.now();

    this.logger.log(`[mathpix] Starting PDF conversion: ${pdfUrl}`);

    // Step 1: Submit PDF for processing
    const processResponse = await this.processPdf(pdfUrl, options);
    const pdfId = processResponse.pdf_id;

    this.logger.log(
      `[mathpix] PDF submitted successfully (pdf_id=${pdfId}, status=${processResponse.status})`,
    );

    // Step 2: Poll for completion
    const statusResponse = await this.pollForCompletion(pdfId, pollingOptions);

    // Step 3: Extract result (markdown is downloaded separately from status)
    if (statusResponse.status !== MathpixStatus.COMPLETED) {
      throw new InternalServerErrorException(
        `Mathpix conversion failed: ${statusResponse.error ?? 'Unknown error'}`,
      );
    }

    const markdown = await this.resolveMarkdownContent(
      pdfId,
      statusResponse.md,
      options,
    );

    if (!markdown) {
      throw new InternalServerErrorException(
        'Mathpix conversion completed but no markdown content returned',
      );
    }

    const processingTimeMs = Date.now() - startTime;

    const result: MathpixConversionResult = {
      pdfId,
      markdown,
      html: statusResponse.html,
      processingTimeMs,
    };

    this.logger.log(
      `[mathpix] Conversion completed successfully (pdf_id=${pdfId}, time=${processingTimeMs}ms, markdown_length=${result.markdown.length})`,
    );

    return result;
  }

  /**
   * Submit a PDF for processing
   * @param pdfUrl Public URL of the PDF file
   * @param options Processing options
   * @returns Process response with PDF ID
   */
  async processPdf(
    pdfUrl: string,
    options: MathpixProcessOptions = {},
  ): Promise<MathpixProcessResponse> {
    this.validateCredentials();

    const payload: MathpixProcessRequest = {
      url: pdfUrl,
      conversion_formats: {
        md: options.conversionFormats?.md ?? true,
        html: options.conversionFormats?.html ?? false,
        docx: options.conversionFormats?.docx ?? false,
        'tex.zip': options.conversionFormats?.tex ?? false,
      },
      include_smiles: options.includeSmiles ?? true,
      include_chemistry_as_image: options.includeChemistryAsImage ?? false,
    };

    try {
      const response = await this.client.post<MathpixProcessResponse>(
        '/pdf',
        payload,
      );

      const data = response.data;

      if (data.error || !data.pdf_id) {
        const message =
          data.error ?? data.error_info?.message ?? 'No pdf_id returned';
        throw new BadRequestException(`Mathpix API error: ${message}`);
      }

      return data;
    } catch (error) {
      this.logger.error(
        '[mathpix] PDF processing request failed',
        error instanceof Error ? error.stack : String(error),
      );

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error ?? error.message;
        throw new BadRequestException(`Mathpix API error: ${message}`);
      }

      throw new InternalServerErrorException(
        'Failed to submit PDF to Mathpix API',
      );
    }
  }

  /**
   * Download converted result in the requested format
   */
  async downloadResult(pdfId: string, format: string): Promise<string> {
    this.validateCredentials();

    try {
      const response = await this.client.get<string>(
        `/pdf/${pdfId}.${format}`,
        {
          responseType: 'text',
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `[mathpix] Download failed for pdf_id=${pdfId}, format=${format}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error ?? error.message;
        throw new BadRequestException(`Mathpix API error: ${message}`);
      }

      throw new InternalServerErrorException(
        'Failed to download result from Mathpix API',
      );
    }
  }

  /**
   * Check the status of a PDF conversion
   * @param pdfId PDF ID returned from processPdf
   * @returns Status response with progress and content
   */
  async checkStatus(pdfId: string): Promise<MathpixStatusResponse> {
    this.validateCredentials();

    try {
      const response = await this.client.get<MathpixStatusResponse>(
        `/pdf/${pdfId}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `[mathpix] Status check failed for pdf_id=${pdfId}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error ?? error.message;
        throw new BadRequestException(`Mathpix API error: ${message}`);
      }

      throw new InternalServerErrorException(
        'Failed to check PDF status from Mathpix API',
      );
    }
  }

  /**
   * Poll for PDF conversion completion
   * Repeatedly checks status until completion or timeout
   *
   * @param pdfId PDF ID to poll
   * @param options Polling configuration
   * @returns Final status response when completed
   */
  async pollForCompletion(
    pdfId: string,
    options: MathpixPollingOptions = {},
  ): Promise<MathpixStatusResponse> {
    const maxAttempts = options.maxAttempts ?? 60;
    const intervalMs = options.intervalMs ?? 5000; // 5 seconds
    const timeoutMs = options.timeoutMs ?? 300000; // 5 minutes

    const startTime = Date.now();
    let attempts = 0;

    this.logger.log(
      `[mathpix] Starting polling for pdf_id=${pdfId} (max_attempts=${maxAttempts}, interval=${intervalMs}ms)`,
    );

    while (attempts < maxAttempts) {
      attempts++;

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new InternalServerErrorException(
          `Mathpix conversion timed out after ${timeoutMs}ms`,
        );
      }

      const status = await this.checkStatus(pdfId);

      this.logger.debug(
        `[mathpix] Poll attempt ${attempts}/${maxAttempts}: status=${status.status}, progress=${status.percent_done ?? 'N/A'}%`,
      );

      // Check if completed
      if (status.status === MathpixStatus.COMPLETED) {
        this.logger.log(
          `[mathpix] Conversion completed after ${attempts} attempts (${Date.now() - startTime}ms)`,
        );
        return status;
      }

      // Check if error
      if (status.status === MathpixStatus.ERROR) {
        const errorMsg =
          status.error ?? status.error_info?.message ?? 'Unknown error';
        throw new InternalServerErrorException(
          `Mathpix conversion failed: ${errorMsg}`,
        );
      }

      // received, loaded, split, or legacy processing — still in progress
      await this.sleep(intervalMs);
    }

    throw new InternalServerErrorException(
      `Mathpix conversion exceeded maximum polling attempts (${maxAttempts})`,
    );
  }

  /**
   * Prefer native MMD output (preserves `<smiles>` tags) over converted MD.
   */
  private async resolveMarkdownContent(
    pdfId: string,
    statusMarkdown: string | undefined,
    options: MathpixProcessOptions,
  ): Promise<string> {
    if (statusMarkdown) {
      return statusMarkdown;
    }

    const preferMmd = options.preferMmdOutput ?? true;
    if (preferMmd) {
      try {
        return await this.downloadResult(pdfId, 'mmd');
      } catch (error) {
        this.logger.warn(
          `[mathpix] MMD download failed for pdf_id=${pdfId}, falling back to MD`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return this.downloadResult(pdfId, 'md');
  }

  /**
   * Validate that Mathpix credentials are configured
   */
  private validateCredentials(): void {
    if (!this.appId || !this.appKey) {
      throw new InternalServerErrorException(
        'Mathpix API credentials not configured. Please set MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables.',
      );
    }
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert PDF buffer to Markdown (uploads to S3 first, then processes)
   * This is a convenience method when you have a PDF buffer instead of URL
   *
   * Note: Requires S3Service to generate temporary pre-signed URL
   *
   * @param pdfBuffer PDF file as Buffer
   * @param options Processing options
   * @param pollingOptions Polling configuration
   * @returns Conversion result with markdown content
   */
  async convertPdfBufferToMarkdown(
    pdfBuffer: Buffer,
    _options: MathpixProcessOptions = {},
    _pollingOptions: MathpixPollingOptions = {},
  ): Promise<MathpixConversionResult> {
    // For this method to work, the PDF must be accessible via public URL
    // The calling code should:
    // 1. Upload PDF to S3
    // 2. Generate pre-signed URL
    // 3. Call convertPdfToMarkdown with the URL
    throw new Error(
      'Direct buffer conversion not implemented. Please upload PDF to S3 first and use the pre-signed URL with convertPdfToMarkdown().',
    );
  }
}
