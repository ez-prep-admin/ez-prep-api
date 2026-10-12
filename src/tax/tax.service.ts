import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TaxBreakdown,
  calculateInclusiveTax,
} from '../common/commerce/calculate-inclusive-tax';
import { INSTANCE_CONFIG_ID } from '../instance-config/instance-config.constants';
import {
  InstanceConfig,
  InstanceConfigDocument,
} from '../instance-config/schemas/instance-config.schema';

@Injectable()
export class TaxService {
  constructor(
    @InjectModel(InstanceConfig.name)
    private readonly instanceConfigModel: Model<InstanceConfigDocument>,
  ) {}

  /**
   * Inclusive tax for a checkout gross amount.
   * Rate and seller state come from instance config. Missing config is an error.
   * Do not hardcode SAC or rate here. Owner-confirmed defaults live in the seed.
   */
  async calculateForCheckout(
    grossAmount: number,
    buyerStateCode: string,
  ): Promise<TaxBreakdown> {
    const config = await this.instanceConfigModel
      .findById(INSTANCE_CONFIG_ID)
      .exec();
    const tax = config?.taxConfig;
    const sellerStateCode = config?.seller?.stateCode;

    if (
      !tax?.taxEnabled ||
      tax.taxRate == null ||
      tax.pricesAreTaxInclusive === false ||
      !sellerStateCode
    ) {
      throw new ServiceUnavailableException(
        'Commerce tax configuration is incomplete. Seed seller and taxConfig before checkout.',
      );
    }

    return calculateInclusiveTax({
      grossAmount,
      taxRate: tax.taxRate,
      sellerStateCode,
      buyerStateCode,
    });
  }
}
