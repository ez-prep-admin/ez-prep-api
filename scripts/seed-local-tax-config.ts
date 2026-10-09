/**
 * Idempotent seed for instance taxConfig + seller.
 *
 * Usage:
 *   npm run commerce:seed-local-tax-config
 *
 * Writes the owner-confirmed seller and tax values onto the existing
 * instance_configs singleton. Does not create the singleton.
 * Safe to re-run. Point MONGODB_URI at production only during the phase 15
 * prod seed (U-OPS-01). Razorpay keys are env vars, not this script.
 *
 * Requires MONGODB_URI (loads .env from repo root when present).
 */
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { resolve } from 'path';
import { INSTANCE_CONFIG_ID } from '../src/instance-config/instance-config.constants';

config({ path: resolve(__dirname, '../.env') });

/** Owner-confirmed 2026-10-09. Edit this payload and re-run if CA changes them. */
const TAX_CONFIG = {
  taxEnabled: true,
  taxType: 'GST',
  taxRate: 18,
  pricesAreTaxInclusive: true,
  currency: 'INR',
  sacCode: '999293',
  sacDescription: 'Commercial training and coaching services',
  invoiceSeriesPrefix: 'EZPREP',
};

/** Owner-confirmed 2026-10-09. GSTIN state prefix 32 matches Kerala. */
const SELLER = {
  legalName: 'EzPrep - Powered by Clustream',
  gstin: '32BIAPD6927L1ZC',
  registeredAddress: 'Kochi, Kerala',
  state: 'Kerala',
  stateCode: '32',
};

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection<{ _id: string }>(
      'instance_configs',
    );
    const result = await collection.updateOne(
      { _id: INSTANCE_CONFIG_ID },
      {
        $set: {
          taxConfig: TAX_CONFIG,
          seller: SELLER,
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error(
        'Instance configuration singleton is missing. Create it before seeding commerce tax config.',
      );
    }

    console.log(
      JSON.stringify(
        {
          collection: 'instance_configs',
          id: INSTANCE_CONFIG_ID,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          legalName: SELLER.legalName,
          gstin: SELLER.gstin,
          registeredAddress: SELLER.registeredAddress,
          sellerState: SELLER.state,
          sellerStateCode: SELLER.stateCode,
          taxRate: TAX_CONFIG.taxRate,
          sacCode: TAX_CONFIG.sacCode,
          note: 'Owner-confirmed seller and taxConfig. Re-run against production Mongo at phase 15.',
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
