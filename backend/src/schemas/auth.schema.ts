import { z } from 'zod';

// Used for BOTH the forced first-login reset and voluntary "change password".
//
// Policy per HR: 8 to 12 characters, with an uppercase letter, a lowercase
// letter and a number. No symbol - the symbol requirement was dropped because
// it rejected otherwise-reasonable passwords and was the immediate cause of a
// failed password reset.
//
// These rules must mirror the Cognito user pool policy in
// serverless-web-stack.yaml. The pool is what actually enforces them, and when
// this schema was laxer than the pool the API accepted a password Cognito
// would always reject, then surfaced its InvalidPasswordException as a blank
// 500 "Internal server error" - telling the user nothing.
//
// The one rule Cognito cannot enforce is the MAXIMUM: its policy has no such
// setting (hard limit 256). The .max() below is therefore the only thing
// stopping a 13-character password.
//
// Validating here means the caller gets a specific, actionable message
// without a round trip. The controller still maps InvalidPasswordException to
// a 400 in case the pool policy is ever tightened past this.
const strongPassword = z
  .string()
  .min(8, 'New password must be at least 8 characters')
  // Cognito has no maximum-length setting (its hard limit is 256), so the
  // upper bound HR asked for can only be enforced here and in the two
  // frontend screens. This is the real gate.
  .max(12, 'New password must be at most 12 characters')
  .regex(/[A-Z]/, 'New password must contain an uppercase letter')
  .regex(/[a-z]/, 'New password must contain a lowercase letter')
  .regex(/[0-9]/, 'New password must contain a number');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
