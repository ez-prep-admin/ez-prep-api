import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoiceService } from './invoice.service';
import { MeInvoicesController } from './me-invoices.controller';

describe('MeInvoicesController', () => {
  const invoices = {
    listForUser: jest.fn(),
    downloadForUser: jest.fn(),
  };
  let controller: MeInvoicesController;

  beforeEach(async () => {
    invoices.listForUser.mockReset();
    invoices.downloadForUser.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeInvoicesController],
      providers: [{ provide: InvoiceService, useValue: invoices }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MeInvoicesController);
  });

  it('lists the caller invoices', async () => {
    invoices.listForUser.mockResolvedValue([]);
    await expect(
      controller.listMine({ id: 'user-1' } as never),
    ).resolves.toEqual({
      message: 'Invoices retrieved successfully',
      data: [],
    });
    expect(invoices.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('downloads only through the caller id', async () => {
    invoices.downloadForUser.mockRejectedValue(
      new NotFoundException('Invoice not found'),
    );

    await expect(
      controller.downloadPdf('inv-1', { id: 'user-2' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(invoices.downloadForUser).toHaveBeenCalledWith('inv-1', 'user-2');
  });

  it('returns a PDF stream for the owner', async () => {
    invoices.downloadForUser.mockResolvedValue({
      body: Buffer.from('pdf'),
      filename: 'SERIES-2026-27-0001.pdf',
    });

    const file = await controller.downloadPdf('inv-1', {
      id: 'user-1',
    } as never);

    expect(file).toBeInstanceOf(StreamableFile);
  });
});
