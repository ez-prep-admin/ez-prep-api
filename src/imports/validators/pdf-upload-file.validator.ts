import { FileValidator } from '@nestjs/common/pipes/file';

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf']);

/**
 * Validates PDF uploads using mimetype + %PDF header bytes.
 *
 * NestJS 10's built-in FileTypeValidator reads magic numbers via a dynamic
 * import of the ESM-only `file-type` package. That often fails on serverless
 * bundles (e.g. Vercel) even when multer reports the correct mimetype.
 */
export class PdfUploadFileValidator extends FileValidator<
  Record<string, never>,
  Express.Multer.File
> {
  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer?.length) {
      return false;
    }

    const mimetype = file.mimetype?.toLowerCase() ?? '';
    if (!PDF_MIME_TYPES.has(mimetype)) {
      return false;
    }

    return file.buffer.subarray(0, 4).toString() === '%PDF';
  }

  buildErrorMessage(file?: Express.Multer.File): string {
    if (!file) {
      return 'PDF file is required.';
    }

    if (!file.buffer?.length) {
      return (
        'Uploaded PDF could not be read (empty buffer). ' +
        'Use multipart/form-data with field name "file".'
      );
    }

    const mimetype = file.mimetype?.toLowerCase() ?? 'unknown';
    const hasPdfHeader = file.buffer.subarray(0, 4).toString() === '%PDF';

    if (!PDF_MIME_TYPES.has(mimetype)) {
      return `Validation failed (current file type is ${mimetype}, expected application/pdf).`;
    }

    if (!hasPdfHeader) {
      return 'Uploaded file is not a valid PDF (missing %PDF header).';
    }

    return 'Uploaded file failed PDF validation.';
  }
}
