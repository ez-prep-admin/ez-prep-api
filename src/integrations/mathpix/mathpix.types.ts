/**
 * Mathpix API Types and Interfaces
 */

/**
 * Mathpix PDF processing options
 */
export interface MathpixProcessOptions {
  /**
   * Output format
   * @default 'md' (markdown)
   */
  conversionFormats?: {
    md?: boolean;
    html?: boolean;
    docx?: boolean;
    tex?: boolean;
  };

  /**
   * Whether to include detected images
   * @default true
   */
  includeImages?: boolean;

  /**
   * Whether to include LaTeX equations
   * @default true
   */
  includeLatex?: boolean;

  /**
   * OCR language
   * @default 'en'
   */
  ocrLanguage?: string;
}

/**
 * Mathpix API request payload for PDF processing
 */
export interface MathpixProcessRequest {
  /**
   * Source file URL or base64 encoded data
   */
  src: string;

  /**
   * Conversion formats
   */
  conversion_formats: Record<string, boolean>;

  /**
   * Additional options
   */
  ocr_languages?: string[];
  include_images?: boolean;
  include_latex?: boolean;
}

/**
 * Mathpix API response for process initiation
 */
export interface MathpixProcessResponse {
  /**
   * Unique PDF ID for tracking
   */
  pdf_id: string;

  /**
   * Status of the processing
   */
  status: 'processing' | 'completed' | 'error';

  /**
   * Message about the status
   */
  message?: string;
}

/**
 * Mathpix PDF status
 */
export enum MathpixStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

/**
 * Mathpix API response for status check
 */
export interface MathpixStatusResponse {
  /**
   * PDF ID
   */
  pdf_id: string;

  /**
   * Current status
   */
  status: MathpixStatus;

  /**
   * Progress percentage (0-100)
   */
  percent_done?: number;

  /**
   * Markdown content (available when status is 'completed')
   */
  md?: string;

  /**
   * HTML content (if requested)
   */
  html?: string;

  /**
   * Error message (if status is 'error')
   */
  error?: string;

  /**
   * Error details
   */
  error_info?: {
    id: string;
    message: string;
  };
}

/**
 * Mathpix conversion result
 */
export interface MathpixConversionResult {
  /**
   * PDF ID
   */
  pdfId: string;

  /**
   * Markdown content
   */
  markdown: string;

  /**
   * HTML content (if requested)
   */
  html?: string;

  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;

  /**
   * Number of pages processed
   */
  pageCount?: number;
}

/**
 * Mathpix polling options
 */
export interface MathpixPollingOptions {
  /**
   * Maximum number of polling attempts
   * @default 60
   */
  maxAttempts?: number;

  /**
   * Interval between polling attempts in milliseconds
   * @default 5000 (5 seconds)
   */
  intervalMs?: number;

  /**
   * Timeout in milliseconds
   * @default 300000 (5 minutes)
   */
  timeoutMs?: number;
}
