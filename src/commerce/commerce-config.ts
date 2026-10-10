export const INSTANCE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;

export type AccessEnforcementSetting = 'LEGACY' | 'ENFORCED';

export type CommerceSettings = {
  nodeEnv: string;
  commerceEnabled: boolean;
  paymentProvider: string;
  instanceId: string;
  instanceName: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  invoicesEnabled: boolean;
  reconciliationEnabled: boolean;
  accessEnforcementMode: AccessEnforcementSetting;
  accessModeWarning?: string;
  trustProxyHops: number;
  maxOpenOrdersPerUser: number;
  webhookRetryWindowMinutes: number;
  lateCaptureWatchHours: number;
  reconciliationBatch: number;
  reconciliationMaxAttempts: number;
  refundUnknownWindowMinutes: number;
};

type EnvSource = {
  get(key: string): string | undefined;
};

export function parseCommerceSettings(env: EnvSource): CommerceSettings {
  const nodeEnv = (env.get('NODE_ENV') ?? '').trim();
  const commerceEnabled = (env.get('COMMERCE_ENABLED') ?? '').trim() === 'true';
  const paymentProvider = (env.get('PAYMENT_PROVIDER') ?? '')
    .trim()
    .toLowerCase();
  const instanceId = (env.get('INSTANCE_ID') ?? '').trim();
  const instanceName = (env.get('INSTANCE_NAME') ?? '').trim();
  const rawMode = (env.get('ACCESS_ENFORCEMENT_MODE') ?? '')
    .trim()
    .toUpperCase();
  const parsed = parseAccessMode(rawMode, nodeEnv, commerceEnabled);

  return {
    nodeEnv,
    commerceEnabled,
    paymentProvider,
    instanceId,
    instanceName,
    razorpayKeyId: (env.get('RAZORPAY_KEY_ID') ?? '').trim(),
    razorpayKeySecret: (env.get('RAZORPAY_KEY_SECRET') ?? '').trim(),
    razorpayWebhookSecret: (env.get('RAZORPAY_WEBHOOK_SECRET') ?? '').trim(),
    invoicesEnabled: (env.get('INVOICES_ENABLED') ?? '').trim() === 'true',
    reconciliationEnabled:
      (env.get('RECONCILIATION_ENABLED') ?? '').trim() === 'true',
    accessEnforcementMode: parsed.mode,
    accessModeWarning: parsed.warning,
    trustProxyHops: nonNegativeInt(env.get('TRUST_PROXY_HOPS'), 0),
    maxOpenOrdersPerUser: positiveInt(env.get('MAX_OPEN_ORDERS_PER_USER'), 3),
    webhookRetryWindowMinutes: nonNegativeInt(
      env.get('WEBHOOK_RETRY_WINDOW_MINUTES'),
      30,
    ),
    lateCaptureWatchHours: nonNegativeInt(
      env.get('LATE_CAPTURE_WATCH_HOURS'),
      72,
    ),
    reconciliationBatch: positiveInt(env.get('RECONCILIATION_BATCH'), 50),
    reconciliationMaxAttempts: positiveInt(
      env.get('RECONCILIATION_MAX_ATTEMPTS'),
      12,
    ),
    refundUnknownWindowMinutes: nonNegativeInt(
      env.get('REFUND_UNKNOWN_WINDOW_MINUTES'),
      60,
    ),
  };
}

export function productionCommerceBootError(
  settings: CommerceSettings,
): string | null {
  if (settings.nodeEnv !== 'production' || !settings.commerceEnabled) {
    return null;
  }

  if (settings.paymentProvider !== 'razorpay') {
    return 'COMMERCE_ENABLED requires PAYMENT_PROVIDER=razorpay in production';
  }
  if (!settings.razorpayKeyId.startsWith('rzp_live_')) {
    return 'COMMERCE_ENABLED requires RAZORPAY_KEY_ID to start with rzp_live_ in production';
  }
  if (!settings.razorpayKeySecret) {
    return 'COMMERCE_ENABLED requires RAZORPAY_KEY_SECRET in production';
  }
  if (!settings.razorpayWebhookSecret) {
    return 'COMMERCE_ENABLED requires RAZORPAY_WEBHOOK_SECRET in production';
  }
  if (!settings.instanceId || !INSTANCE_ID_PATTERN.test(settings.instanceId)) {
    return 'COMMERCE_ENABLED requires INSTANCE_ID in production';
  }
  if (!settings.instanceName) {
    return 'COMMERCE_ENABLED requires INSTANCE_NAME in production';
  }
  if (!settings.invoicesEnabled) {
    return 'COMMERCE_ENABLED requires INVOICES_ENABLED=true in production';
  }
  if (!settings.reconciliationEnabled) {
    return 'COMMERCE_ENABLED requires RECONCILIATION_ENABLED=true in production';
  }
  return null;
}

function parseAccessMode(
  raw: string,
  nodeEnv: string,
  commerceEnabled: boolean,
): { mode: AccessEnforcementSetting; warning?: string } {
  if (raw === '' || raw === 'LEGACY') {
    return { mode: 'LEGACY' };
  }
  if (raw === 'ENFORCED') {
    return { mode: 'ENFORCED' };
  }
  if (nodeEnv === 'production' && commerceEnabled) {
    throw new Error(
      'COMMERCE_ENABLED requires ACCESS_ENFORCEMENT_MODE to be LEGACY or ENFORCED',
    );
  }
  return {
    mode: 'LEGACY',
    warning: `ACCESS_ENFORCEMENT_MODE "${raw}" is not LEGACY or ENFORCED; using LEGACY`,
  };
}

function nonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}
