import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertWriteAllowed,
  describeCommerceDiff,
  parseSeedArgs,
  parseTaxSeed,
  seedFileName,
  validateTaxSeed,
} from '../../../scripts/commerce-seed/tax-config-file';

const ezprep = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../scripts/commerce-seed/ezprep.json'),
    'utf8',
  ),
) as Record<string, unknown>;

describe('tax config seed file', () => {
  it('selects the file for INSTANCE_ID and never ezprep.json for examflex', () => {
    expect(seedFileName('ezprep')).toBe('ezprep.json');
    expect(seedFileName('examflex')).toBe('examflex.json');
    expect(seedFileName('examflex')).not.toBe('ezprep.json');
    expect(() => seedFileName('  ')).toThrow(/INSTANCE_ID is required/);
  });

  it('refuses a file whose instanceId does not match', () => {
    expect(() => parseTaxSeed(ezprep, 'examflex')).toThrow(
      /does not match INSTANCE_ID "examflex"/,
    );
    expect(parseTaxSeed(ezprep, 'ezprep')).toMatchObject({
      instanceId: 'ezprep',
      seller: { registeredAddress: 'Kerala', gstin: '32BIAPD6927L1ZC' },
    });
  });

  it.each([
    ['gstin length', { seller: { gstin: 'SHORT' } }, /15 characters/],
    [
      'unknown state',
      { seller: { stateCode: '25' } },
      /known Indian state code/,
    ],
    ['rate', { taxConfig: { taxRate: 18.5 } }, /integer from 0 to 100/],
    [
      'prefix',
      { taxConfig: { invoiceSeriesPrefix: 'ez-prep' } },
      /\[A-Z0-9\]\+/,
    ],
  ])('rejects %s', (_label, patch, pattern) => {
    const body = structuredClone(ezprep) as Record<string, unknown>;
    const seller = {
      ...(body.seller as object),
      ...((patch as { seller?: object }).seller ?? {}),
    };
    const taxConfig = {
      ...(body.taxConfig as object),
      ...((patch as { taxConfig?: object }).taxConfig ?? {}),
    };
    const errors = validateTaxSeed({ ...body, seller, taxConfig });
    expect(errors.join('\n')).toMatch(pattern);
  });

  it('prints a field diff and leaves unchanged fields labeled', () => {
    const next = parseTaxSeed(ezprep, 'ezprep');
    const lines = describeCommerceDiff(
      {
        seller: {
          legalName: next.seller.legalName,
          registeredAddress: 'Kochi, Kerala',
          gstin: next.seller.gstin,
          state: next.seller.state,
          stateCode: next.seller.stateCode,
        },
        taxConfig: { ...next.taxConfig },
      },
      next,
    );
    expect(lines).toContain(
      'seller.registeredAddress: "Kochi, Kerala" -> "Kerala"',
    );
    expect(lines).toContain('seller.legalName: unchanged');
    expect(lines).toContain('taxConfig.taxRate: unchanged');
  });

  it('refuses a production write without --confirm-db', () => {
    expect(parseSeedArgs([])).toEqual({ apply: false, confirmDb: undefined });
    expect(parseSeedArgs(['--apply', '--confirm-db', 'ezprep'])).toEqual({
      apply: true,
      confirmDb: 'ezprep',
    });
    expect(() =>
      assertWriteAllowed({
        nodeEnv: 'production',
        apply: true,
        databaseName: 'ezprep',
      }),
    ).toThrow(/without --confirm-db/);
    expect(() =>
      assertWriteAllowed({
        nodeEnv: 'production',
        apply: true,
        confirmDb: 'other',
        databaseName: 'ezprep',
      }),
    ).toThrow(/does not match/);
    expect(() =>
      assertWriteAllowed({
        nodeEnv: 'development',
        apply: true,
        databaseName: 'ezprep',
      }),
    ).not.toThrow();
  });
});
