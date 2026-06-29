import 'reflect-metadata';
import { PdfUploadFileValidator } from './pdf-upload-file.validator';

describe('PdfUploadFileValidator', () => {
  const validator = new PdfUploadFileValidator({});

  const pdfBuffer = Buffer.from('%PDF-1.4 fake content');

  it('accepts a valid PDF buffer with application/pdf mimetype', () => {
    expect(
      validator.isValid({
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toBe(true);
  });

  it('rejects files without a buffer', () => {
    expect(
      validator.isValid({
        mimetype: 'application/pdf',
        size: 0,
      } as Express.Multer.File),
    ).toBe(false);
    expect(validator.buildErrorMessage(undefined)).toContain('required');
  });

  it('rejects non-PDF mimetypes even when buffer looks like PDF', () => {
    expect(
      validator.isValid({
        mimetype: 'image/png',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toBe(false);
  });

  it('rejects buffers missing the %PDF header', () => {
    expect(
      validator.isValid({
        mimetype: 'application/pdf',
        size: 4,
        buffer: Buffer.from('NOTA'),
      } as Express.Multer.File),
    ).toBe(false);
  });
});
