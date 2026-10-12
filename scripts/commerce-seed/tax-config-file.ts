import { indianStateByCode } from '../../src/common/commerce/indian-states';

export type TaxSeedSeller = {
  legalName: string;
  gstin: string;
  registeredAddress: string;
  state: string;
  stateCode: string;
};

export type TaxSeedConfig = {
  taxEnabled: boolean;
  taxType: string;
  taxRate: number;
  pricesAreTaxInclusive: boolean;
  currency: string;
  sacCode: string;
  sacDescription: string;
  invoiceSeriesPrefix: string;
};

export type TaxSeedFile = {
  instanceId: string;
  seller: TaxSeedSeller;
  taxConfig: TaxSeedConfig;
};

export type SeedCliOptions = {
  apply: boolean;
  confirmDb?: string;
};

const PREFIX = /^[A-Z0-9]+$/;

export function seedFileName(instanceId: string): string {
  const id = instanceId.trim();
  if (!id) {
    throw new Error('INSTANCE_ID is required');
  }
  return `${id}.json`;
}

export function parseSeedArgs(argv: string[]): SeedCliOptions {
  let apply = false;
  let confirmDb: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--confirm-db') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--confirm-db requires the database name');
      }
      confirmDb = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--confirm-db=')) {
      confirmDb = arg.slice('--confirm-db='.length);
      if (!confirmDb) {
        throw new Error('--confirm-db requires the database name');
      }
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }
  return { apply, confirmDb };
}

export function assertWriteAllowed(input: {
  nodeEnv: string | undefined;
  apply: boolean;
  confirmDb?: string;
  databaseName: string;
}): void {
  if (!input.apply) {
    return;
  }
  if (input.confirmDb && input.confirmDb !== input.databaseName) {
    throw new Error(
      `--confirm-db ${input.confirmDb} does not match the connected database ${input.databaseName}`,
    );
  }
  if ((input.nodeEnv ?? '').trim() === 'production' && !input.confirmDb) {
    throw new Error(
      'Refusing to write tax config in production without --confirm-db <database name>',
    );
  }
}

export function parseTaxSeed(
  raw: unknown,
  instanceId: string,
): TaxSeedFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Tax seed file must be a JSON object');
  }
  const body = raw as Record<string, unknown>;
  const fileInstanceId =
    typeof body.instanceId === 'string' ? body.instanceId.trim() : '';
  if (!fileInstanceId) {
    throw new Error('Tax seed file is missing instanceId');
  }
  if (fileInstanceId !== instanceId.trim()) {
    throw new Error(
      `Seed file instanceId "${fileInstanceId}" does not match INSTANCE_ID "${instanceId.trim()}". Refusing to write another instance's seller identity.`,
    );
  }
  const errors = validateTaxSeed(body);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return body as TaxSeedFile;
}

export function validateTaxSeed(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const seller = asRecord(body.seller);
  const tax = asRecord(body.taxConfig);
  if (!seller) {
    errors.push('seller is required');
  } else {
    requireText(errors, 'seller.legalName', seller.legalName);
    requireText(errors, 'seller.registeredAddress', seller.registeredAddress);
    requireText(errors, 'seller.state', seller.state);
    if (typeof seller.gstin !== 'string' || seller.gstin.length !== 15) {
      errors.push('seller.gstin must be 15 characters');
    }
    if (
      typeof seller.stateCode !== 'string' ||
      !indianStateByCode(seller.stateCode)
    ) {
      errors.push('seller.stateCode must be a known Indian state code');
    }
  }
  if (!tax) {
    errors.push('taxConfig is required');
  } else {
    if (
      typeof tax.taxRate !== 'number' ||
      !Number.isInteger(tax.taxRate) ||
      tax.taxRate < 0 ||
      tax.taxRate > 100
    ) {
      errors.push('taxConfig.taxRate must be an integer from 0 to 100');
    }
    if (
      typeof tax.invoiceSeriesPrefix !== 'string' ||
      !PREFIX.test(tax.invoiceSeriesPrefix)
    ) {
      errors.push('taxConfig.invoiceSeriesPrefix must match [A-Z0-9]+');
    }
    requireText(errors, 'taxConfig.sacCode', tax.sacCode);
    requireText(errors, 'taxConfig.sacDescription', tax.sacDescription);
  }
  return errors;
}

export function describeCommerceDiff(
  current: {
    seller?: Record<string, unknown>;
    taxConfig?: Record<string, unknown>;
  } | null,
  next: TaxSeedFile,
): string[] {
  const lines: string[] = [];
  for (const section of ['seller', 'taxConfig'] as const) {
    const before = current?.[section] ?? {};
    const after = next[section] as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      const left = before[key];
      const right = after[key];
      if (sameValue(left, right)) {
        lines.push(`${section}.${key}: unchanged`);
      } else {
        lines.push(
          `${section}.${key}: ${showValue(left)} -> ${showValue(right)}`,
        );
      }
    }
  }
  return lines;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function requireText(
  errors: string[],
  field: string,
  value: unknown,
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field} is required`);
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function showValue(value: unknown): string {
  if (value === undefined) {
    return '(missing)';
  }
  return JSON.stringify(value);
}
