import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoiceService } from './invoice.service';

describe('AdminInvoicesController', () => {
  const invoices = {
    listForAdmin: jest.fn(),
    downloadForAdmin: jest.fn(),
  };
  let controller: AdminInvoicesController;

  beforeEach(async () => {
    invoices.listForAdmin.mockReset();
    invoices.downloadForAdmin.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInvoicesController],
      providers: [{ provide: InvoiceService, useValue: invoices }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AdminInvoicesController);
  });

  it('requires the admin role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminInvoicesController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('lists invoices', async () => {
    invoices.listForAdmin.mockResolvedValue([]);
    await expect(controller.list()).resolves.toEqual({
      message: 'Invoices retrieved successfully',
      data: [],
    });
  });

  it('downloads any invoice PDF', async () => {
    invoices.downloadForAdmin.mockResolvedValue({
      body: Buffer.from('pdf'),
      filename: 'SERIES-2026-27-0001.pdf',
    });

    const file = await controller.downloadPdf('inv-1');

    expect(invoices.downloadForAdmin).toHaveBeenCalledWith('inv-1');
    expect(file).toBeInstanceOf(StreamableFile);
  });
});
