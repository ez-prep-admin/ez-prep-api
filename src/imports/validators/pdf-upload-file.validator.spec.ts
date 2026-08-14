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

  it('accepts application/x-pdf mimetype', () => {
    expect(
      validator.isValid({
        mimetype: 'application/x-pdf',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toBe(true);
  });

  it('rejects missing files from isValid', () => {
    expect(validator.isValid(undefined)).toBe(false);
  });

  it('rejects empty buffers from isValid', () => {
    expect(
      validator.isValid({
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).toBe(false);
  });

  it('buildErrorMessage covers empty buffer', () => {
    expect(
      validator.buildErrorMessage({
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).toContain('empty buffer');
  });

  it('buildErrorMessage covers missing buffer', () => {
    expect(
      validator.buildErrorMessage({
        mimetype: 'application/pdf',
      } as Express.Multer.File),
    ).toContain('empty buffer');
  });

  it('buildErrorMessage reports unknown mimetype when omitted', () => {
    expect(
      validator.buildErrorMessage({
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toContain('current file type is unknown');
  });

  it('buildErrorMessage reports unexpected mimetype', () => {
    expect(
      validator.buildErrorMessage({
        mimetype: 'IMAGE/PNG',
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toContain('expected application/pdf');
  });

  it('buildErrorMessage reports missing %PDF header', () => {
    expect(
      validator.buildErrorMessage({
        mimetype: 'application/pdf',
        buffer: Buffer.from('NOTA'),
      } as Express.Multer.File),
    ).toContain('missing %PDF header');
  });

  it('buildErrorMessage falls back when mimetype and header look valid', () => {
    expect(
      validator.buildErrorMessage({
        mimetype: 'application/pdf',
        buffer: pdfBuffer,
      } as Express.Multer.File),
    ).toBe('Uploaded file failed PDF validation.');
  });
});
