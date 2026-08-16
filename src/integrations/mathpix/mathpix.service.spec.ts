import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { MathpixService } from './mathpix.service';
import { MathpixStatus } from './mathpix.types';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    default: Object.assign(actual, {
      create: jest.fn(() => ({
        post: (...args: unknown[]) => mockPost(...args),
        get: (...args: unknown[]) => mockGet(...args),
      })),
    }),
    isAxiosError: actual.isAxiosError,
  };
});

describe('MathpixService', () => {
  function build(appId = 'id', appKey = 'key') {
    return new MathpixService({
      get: jest.fn((key: string) => {
        if (key === 'MATHPIX_APP_ID') return appId;
        if (key === 'MATHPIX_APP_KEY') return appKey;
        return undefined;
      }),
    } as unknown as ConfigService);
  }

  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('warns when credentials are missing but still constructs', () => {
    expect(() => build('', '')).not.toThrow();
  });

  it('processPdf posts the payload and returns pdf_id', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    const service = build();
    const result = await service.processPdf('https://s3/file.pdf', {
      includeSmiles: false,
    });
    expect(result.pdf_id).toBe('pdf-1');
    expect(mockPost).toHaveBeenCalledWith(
      '/pdf',
      expect.objectContaining({ url: 'https://s3/file.pdf' }),
    );
  });

  it('processPdf throws when the API omits pdf_id', async () => {
    mockPost.mockResolvedValue({ data: { error: 'bad pdf' } });
    await expect(build().processPdf('https://s3/file.pdf')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('processPdf maps axios errors', async () => {
    const error = {
      isAxiosError: true,
      message: 'network',
      response: { data: { error: 'quota' } },
    };
    Object.setPrototypeOf(error, new Error().constructor.prototype);
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true as never);
    mockPost.mockRejectedValue(error);

    await expect(build().processPdf('https://s3/file.pdf')).rejects.toThrow(
      /quota/,
    );
  });

  it('processPdf wraps unknown errors', async () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    mockPost.mockRejectedValue('weird');
    await expect(build().processPdf('https://s3/file.pdf')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('rejects processPdf without credentials', async () => {
    await expect(build('', '').processPdf('https://x')).rejects.toThrow(
      /credentials not configured/,
    );
  });

  it('checkStatus and downloadResult return API data', async () => {
    mockGet.mockResolvedValueOnce({ data: { status: 'completed' } });
    mockGet.mockResolvedValueOnce({ data: '# md' });
    const service = build();
    await expect(service.checkStatus('pdf-1')).resolves.toEqual({
      status: 'completed',
    });
    await expect(service.downloadResult('pdf-1', 'md')).resolves.toBe('# md');
  });

  it('pollForCompletion returns when completed', async () => {
    mockGet.mockResolvedValue({
      data: { status: MathpixStatus.COMPLETED, pdf_id: 'pdf-1' },
    });
    const status = await build().pollForCompletion('pdf-1', {
      maxAttempts: 2,
      intervalMs: 1,
      timeoutMs: 5000,
    });
    expect(status.status).toBe(MathpixStatus.COMPLETED);
  });

  it('pollForCompletion throws on ERROR status', async () => {
    mockGet.mockResolvedValue({
      data: { status: MathpixStatus.ERROR, error: 'ocr failed' },
    });
    await expect(
      build().pollForCompletion('pdf-1', { maxAttempts: 2, intervalMs: 1 }),
    ).rejects.toThrow(/ocr failed/);
  });

  it('pollForCompletion throws after max attempts', async () => {
    mockGet.mockResolvedValue({
      data: { status: MathpixStatus.LOADED },
    });
    await expect(
      build().pollForCompletion('pdf-1', {
        maxAttempts: 2,
        intervalMs: 1,
        timeoutMs: 60_000,
      }),
    ).rejects.toThrow(/maximum polling attempts/);
  });

  it('convertPdfToMarkdown uses status markdown when present', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    mockGet.mockResolvedValue({
      data: {
        status: MathpixStatus.COMPLETED,
        pdf_id: 'pdf-1',
        md: '# paper',
      },
    });

    const result = await build().convertPdfToMarkdown(
      'https://s3/a.pdf',
      {},
      {
        maxAttempts: 2,
        intervalMs: 1,
      },
    );
    expect(result.markdown).toBe('# paper');
    expect(result.pdfId).toBe('pdf-1');
  });

  it('convertPdfToMarkdown downloads mmd when status md is missing', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    mockGet
      .mockResolvedValueOnce({
        data: { status: MathpixStatus.COMPLETED, pdf_id: 'pdf-1' },
      })
      .mockResolvedValueOnce({ data: '# mmd' });

    const result = await build().convertPdfToMarkdown(
      'https://s3/a.pdf',
      {
        preferMmdOutput: true,
      },
      { maxAttempts: 2, intervalMs: 1 },
    );
    expect(result.markdown).toBe('# mmd');
  });

  it('convertPdfBufferToMarkdown is not implemented', async () => {
    await expect(
      build().convertPdfBufferToMarkdown(Buffer.from('pdf')),
    ).rejects.toThrow(/not implemented/);
  });

  it('convertPdfToMarkdown throws when status is not completed', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    mockGet.mockResolvedValue({
      data: { status: MathpixStatus.ERROR, error: 'ocr failed' },
    });
    await expect(
      build().convertPdfToMarkdown(
        'https://s3/a.pdf',
        {},
        { maxAttempts: 2, intervalMs: 1 },
      ),
    ).rejects.toThrow(/ocr failed/);
  });

  it('convertPdfToMarkdown throws when markdown is empty', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    mockGet
      .mockResolvedValueOnce({
        data: { status: MathpixStatus.COMPLETED, pdf_id: 'pdf-1' },
      })
      .mockResolvedValueOnce({ data: '' })
      .mockResolvedValueOnce({ data: '' });
    await expect(
      build().convertPdfToMarkdown(
        'https://s3/a.pdf',
        { preferMmdOutput: true },
        { maxAttempts: 2, intervalMs: 1 },
      ),
    ).rejects.toThrow(/no markdown content/);
  });

  it('maps axios errors from downloadResult and checkStatus', async () => {
    const error = {
      isAxiosError: true,
      message: 'network',
      response: { data: { error: 'gone' } },
    };
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true as never);
    mockGet.mockRejectedValue(error);
    const service = build();
    await expect(service.downloadResult('pdf-1', 'md')).rejects.toThrow(/gone/);
    await expect(service.checkStatus('pdf-1')).rejects.toThrow(/gone/);
  });

  it('wraps unknown download and status errors', async () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    mockGet.mockRejectedValue('weird');
    const service = build();
    await expect(service.downloadResult('pdf-1', 'md')).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.checkStatus('pdf-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('pollForCompletion times out when timeoutMs is exceeded', async () => {
    mockGet.mockResolvedValue({
      data: { status: MathpixStatus.LOADED },
    });
    await expect(
      build().pollForCompletion('pdf-1', {
        maxAttempts: 5,
        intervalMs: 1,
        timeoutMs: 0,
      }),
    ).rejects.toThrow(/timed out/);
  });

  it('falls back from mmd to md when mmd download fails', async () => {
    mockPost.mockResolvedValue({
      data: { pdf_id: 'pdf-1', status: 'received' },
    });
    mockGet
      .mockResolvedValueOnce({
        data: { status: MathpixStatus.COMPLETED, pdf_id: 'pdf-1' },
      })
      .mockRejectedValueOnce(new Error('mmd missing'))
      .mockResolvedValueOnce({ data: '# md-fallback' });

    const result = await build().convertPdfToMarkdown(
      'https://s3/a.pdf',
      { preferMmdOutput: true },
      { maxAttempts: 2, intervalMs: 1 },
    );
    expect(result.markdown).toBe('# md-fallback');
  });
});
