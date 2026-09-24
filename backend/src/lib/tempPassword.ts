// Temporary-password generation for new employees and admin resets.
//
// This exists because the previous one-liner, duplicated in two services:
//
//   'Jobly@' + Math.random().toString(36).slice(2, 8).toUpperCase()
//
// produced a password with NO DIGIT about 14% of the time. The random suffix
// is base-36 uppercased, so each character is a digit only 10 times in 36, and
// six such characters miss entirely at (26/36)^6. Cognito's password policy
// sets RequireNumbers, so it rejected roughly one in seven generated
// passwords with InvalidPasswordException - surfacing to staff as "internal
// server error" when creating an employee or resetting a password, and looking
// random because it was.
//
// The generator now guarantees one character from each required class before
// filling the remainder, so it cannot violate the policy.
//
// It also uses crypto.randomInt rather than Math.random. These are real
// credentials sent by email; Math.random is a predictable PRNG and is not an
// appropriate source for them.
import { randomInt } from 'node:crypto';

// Deliberately excludes the characters people misread when copying a password
// out of an email: O/0, I/1/l. The policy needs upper, lower and digit, so
// each class is drawn from its own pool.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const ALL = UPPER + LOWER + DIGIT;

/** Length of a generated temporary password. Must sit inside the policy's 8–12. */
export const TEMP_PASSWORD_LENGTH = 12;

const pick = (chars: string): string => chars[randomInt(chars.length)];

/**
 * A temporary password that always satisfies the Cognito pool policy:
 * 8–12 characters with at least one uppercase, one lowercase and one digit.
 *
 * No symbol: the pool no longer requires one, and symbols are the thing people
 * most often mistype when reading a password out of an email.
 */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  // One from each required class first, so the policy is satisfied by
  // construction rather than by luck.
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(ALL));
  const chars = [...required, ...rest];

  // Fisher-Yates, so the guaranteed characters aren't always in positions 0-2.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
