import { z } from 'zod';

// Legal marks a document reviewed/flagged for HR's attention. Comment is
// optional even when flagging — Legal may just want to confirm "looks fine"
// (flagged: false clears a prior flag).
export const legalReviewSchema = z.object({
  legalFlagged: z.boolean(),
  legalFlagComment: z.string().max(2000).optional().nullable(),
});

export type LegalReviewInput = z.infer<typeof legalReviewSchema>;
