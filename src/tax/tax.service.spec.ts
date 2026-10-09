import { ServiceUnavailableException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { InstanceConfig } from '../instance-config/schemas/instance-config.schema';
import { TaxService } from './tax.service';

describe('TaxService', () => {
  let service: TaxService;
  const model = { findById: jest.fn() };

  beforeEach(async () => {
    model.findById.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: getModelToken(InstanceConfig.name), useValue: model },
      ],
    }).compile();
    service = module.get(TaxService);
  });

  function config(overrides: Record<string, unknown> = {}) {
    return {
      taxConfig: {
        taxEnabled: true,
        taxRate: 18,
        pricesAreTaxInclusive: true,
        ...((overrides.taxConfig as object) ?? {}),
      },
      seller: {
        stateCode: '32',
        ...((overrides.seller as object) ?? {}),
      },
    };
  }

  it('calculates from instance taxConfig and seller state', async () => {
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(config()),
    });

    await expect(service.calculateForCheckout(99900, '32')).resolves.toEqual({
      grossAmount: 99900,
      taxableAmount: 84661,
      taxAmount: 15239,
      cgst: 7619,
      sgst: 7620,
      igst: 0,
      taxRate: 18,
    });
  });

  it('fails when seller or tax rate is missing', async () => {
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ taxConfig: { taxEnabled: true } }),
    });

    await expect(
      service.calculateForCheckout(99900, '32'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
