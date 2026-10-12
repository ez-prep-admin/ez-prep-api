const TOUCHED = [
  'MONGODB_URI',
  'REDIS_URL',
  'PAYMENT_PROVIDER',
  'INVOICES_ENABLED',
  'ACCESS_ENFORCEMENT_MODE',
  'RECONCILIATION_ENABLED',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'JWT_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'AWS_S3_IMAGE_BUCKET',
  'AWS_S3_INVOICES_BUCKET',
  'OBSERVE_APP_KEY',
  'OBSERVE_APP_SECRET',
  'COMMERCE_ENABLED',
] as const;

export type HarnessEnvOptions = {
  mongoUri: string;
  paymentProvider: 'fake' | 'razorpay';
  accessMode: 'LEGACY' | 'ENFORCED';
  commerceEnabled?: string;
  invoicesEnabled?: string;
};

const previous = new Map<string, string | undefined>();
let saved = false;

export function applyHarnessEnv(options: HarnessEnvOptions): void {
  if (!saved) {
    for (const key of TOUCHED) {
      previous.set(key, process.env[key]);
    }
    saved = true;
  }

  process.env.MONGODB_URI = options.mongoUri;
  process.env.REDIS_URL = '';
  process.env.PAYMENT_PROVIDER = options.paymentProvider;
  process.env.INVOICES_ENABLED = options.invoicesEnabled ?? 'true';
  process.env.ACCESS_ENFORCEMENT_MODE = options.accessMode;
  process.env.RECONCILIATION_ENABLED = 'false';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_harness';
  process.env.RAZORPAY_KEY_SECRET = 'harness_key_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'harness_webhook_secret';
  process.env.JWT_SECRET = 'harness-jwt-secret';
  process.env.AWS_ACCESS_KEY_ID = 'harness-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'harness-secret-key';
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_S3_BUCKET = 'harness-bucket';
  process.env.AWS_S3_IMAGE_BUCKET = 'harness-images';
  process.env.AWS_S3_INVOICES_BUCKET = 'harness-invoices';
  process.env.OBSERVE_APP_KEY = '';
  process.env.OBSERVE_APP_SECRET = '';
  if (options.commerceEnabled === undefined) {
    process.env.COMMERCE_ENABLED = 'true';
  } else {
    process.env.COMMERCE_ENABLED = options.commerceEnabled;
  }
}

export function restoreHarnessEnv(): void {
  if (!saved) {
    return;
  }
  for (const [key, value] of previous) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  saved = false;
  previous.clear();
}
