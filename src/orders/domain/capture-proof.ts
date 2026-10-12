export const CAPTURE_PROOF_SOURCES = [
  'VERIFY_FETCH',
  'WEBHOOK',
  'RECON_FETCH',
] as const;

export type CaptureProofSource = (typeof CAPTURE_PROOF_SOURCES)[number];

export type CaptureProof = {
  source: CaptureProofSource;
  providerPaymentId: string;
  amount: number;
  currency: string;
};
