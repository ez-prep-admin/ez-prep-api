export const StudentAuthProvider = {
  OTP: 'otp',
  GOOGLE: 'google',
} as const;

export type StudentAuthProviderName =
  (typeof StudentAuthProvider)[keyof typeof StudentAuthProvider];

/**
 * Identity proven by an external provider before we look up or create a student.
 * OTP and Google differ only in how this object is produced.
 */
export interface VerifiedStudentIdentity {
  provider: StudentAuthProviderName;
  phoneNumber?: string;
  googleSub?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}
