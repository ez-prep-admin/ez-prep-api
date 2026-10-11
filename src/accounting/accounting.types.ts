export const DEFAULT_CURRENCY = 'INR';

export interface MoneyTotal {
  currency: string;
  amountPaise: number;
}

export interface AccountingOverviewBody {
  people: {
    paidUsers: number;
    freeUsers: number;
    learners: number;
  };
  entitlements: {
    issued: number;
    active: number;
    expired: number;
    revoked: number;
  };
  orders: {
    paid: number;
    refunded: number;
    pending: number;
    failed: number;
    expired: number;
    cancelled: number;
  };
  catalog: {
    products: {
      published: number;
      draft: number;
      archived: number;
    };
    offers: {
      active: number;
      inactive: number;
    };
  };
  money: {
    paymentsReceived: MoneyTotal[];
    refundsIssued: MoneyTotal[];
    duplicateCaptureRefunds: MoneyTotal[];
    netReceipts: MoneyTotal[];
    taxOnPaidOrders: MoneyTotal[];
    invoicesIssued: number;
  };
}

export interface AccountingOverview extends AccountingOverviewBody {
  computedAt: string;
  freshUntil: string;
}
