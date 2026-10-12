import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function typescriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return typescriptFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('Razorpay import boundary', () => {
  it('imports the razorpay package only from the SDK client', () => {
    const src = join(__dirname, '../../..');
    const allowed = join(__dirname, 'razorpay-sdk.client.ts');
    const offenders = typescriptFiles(src).filter(path => {
      if (path === allowed) {
        return false;
      }
      const source = readFileSync(path, 'utf8');
      return (
        source.includes("from 'razorpay'") ||
        source.includes('from "razorpay"') ||
        source.includes("require('razorpay')") ||
        source.includes('require("razorpay")')
      );
    });
    expect(offenders).toEqual([]);
  });
});
