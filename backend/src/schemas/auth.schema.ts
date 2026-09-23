import { z } from 'zod';

// Used for BOTH the forced first-login reset and voluntary "change password".
// These rules mirror the Cognito user pool password policy exactly (minimum
// length 12, upper + lower + number + symbol). They have to: the pool is the
// thing that actually enforces them, and when this schema was laxer than the
// pool the API happily accepted a password Cognito would always reject, then
// surfaced its InvalidPasswordException as a blank 500 "Internal server
// error" - so a user picking a 15-character alphanumeric password was told
// nothing except that something had broken.
//
// Validating here means the caller gets a specific, actionable message
// without a round trip. The controller still maps InvalidPasswordException to
// a 400 in case the pool policy is ever tightened past this.
const strongPassword = z
  .string()
  .min(12, 'New password must be at least 12 characters')
  .regex(/[A-Z]/, 'New password must contain an uppercase letter')
  .regex(/[a-z]/, 'New password must contain a lowercase letter')
  .regex(/[0-9]/, 'New password must contain a number')
  // Cognito's allowed symbol set, per the AWS password policy documentation.
  .regex(/[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`=+\- ]/, 'New password must contain a symbol');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
