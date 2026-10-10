/**
 * Per-instance seller and tax seed.
 *
 *   npm run commerce:seed-tax-config
 *   npm run commerce:seed-tax-config -- --apply
 *   npm run commerce:seed-tax-config -- --apply --confirm-db <database name>
 *
 * Dry run is the default. It prints the connected database name and a
 * field-by-field diff, and it does not write.
 * The file is scripts/commerce-seed/<INSTANCE_ID>.json. A file whose
 * instanceId does not match INSTANCE_ID is refused.
 * Production also requires --confirm-db with that database's name.
 */
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import mongoose from 'mongoose';
import { resolve } from 'path';
import { INSTANCE_CONFIG_ID } from '../../src/instance-config/instance-config.constants';
import {
  assertWriteAllowed,
  describeCommerceDiff,
  parseSeedArgs,
  parseTaxSeed,
  seedFileName,
  TaxSeedFile,
} from './tax-config-file';

config({ path: resolve(__dirname, '../../.env') });

const SEED_DIR = __dirname;

async function main(): Promise<void> {
  const options = parseSeedArgs(process.argv.slice(2));
  const instanceId = process.env.INSTANCE_ID?.trim() ?? '';
  const fileName = seedFileName(instanceId);
  const filePath = resolve(SEED_DIR, fileName);
  if (!existsSync(filePath)) {
    throw new Error(
      `No tax seed file for INSTANCE_ID=${instanceId}. Expected scripts/commerce-seed/${fileName}`,
    );
  }

  const parsed = parseTaxSeed(
    JSON.parse(readFileSync(filePath, 'utf8')),
    instanceId,
  );
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const databaseName = mongoose.connection.db?.databaseName;
    if (!databaseName) {
      throw new Error('Could not read the database name from MONGODB_URI');
    }
    assertWriteAllowed({
      nodeEnv: process.env.NODE_ENV,
      apply: options.apply,
      confirmDb: options.confirmDb,
      databaseName,
    });

    const collection = mongoose.connection.collection<{
      _id: string;
      seller?: Record<string, unknown>;
      taxConfig?: Record<string, unknown>;
    }>('instance_configs');
    const current = await collection.findOne({ _id: INSTANCE_CONFIG_ID });
    const diff = describeCommerceDiff(current, parsed);
    console.log(
      JSON.stringify(
        {
          mode: options.apply ? 'apply' : 'dry-run',
          database: databaseName,
          file: `scripts/commerce-seed/${fileName}`,
          instanceId: parsed.instanceId,
          diff,
        },
        null,
        2,
      ),
    );
    if (!options.apply) {
      return;
    }
    await applySeed(collection, parsed);
  } finally {
    await mongoose.disconnect();
  }
}

async function applySeed(
  collection: mongoose.Collection<{ _id: string }>,
  parsed: TaxSeedFile,
): Promise<void> {
  const result = await collection.updateOne(
    { _id: INSTANCE_CONFIG_ID },
    {
      $set: {
        seller: parsed.seller,
        taxConfig: parsed.taxConfig,
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
        legalName: parsed.seller.legalName,
        gstin: parsed.seller.gstin,
        registeredAddress: parsed.seller.registeredAddress,
        sellerState: parsed.seller.state,
        sellerStateCode: parsed.seller.stateCode,
        taxRate: parsed.taxConfig.taxRate,
        sacCode: parsed.taxConfig.sacCode,
      },
      null,
      2,
    ),
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
