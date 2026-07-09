import { z } from 'zod';

// The 12 fixed appraisal criteria, in the exact order the reference template
// uses — shared by the Zod validator and the PDF generator so the rating
// grid's row order and keys can never drift apart.
export const RATING_CRITERIA = [
  { key: 'achieves_set_objectives', label: 'Achieves Set Objectives' },
  { key: 'open_to_constructive_criticism', label: 'Open To Constructive Criticism' },
  { key: 'demonstrates_required_job_skills', label: 'Demonstrates Required Job Skills And Knowledge' },
  { key: 'demonstrates_management_leadership', label: 'Demonstrates Effective Management And Leadership Skills' },
  { key: 'completes_all_responsibilities', label: 'Completes All Assigned Responsibilities' },
  { key: 'meets_attendance_requirements', label: 'Meets Attendance Requirements' },
  { key: 'takes_responsibility_for_actions', label: 'Takes Responsibility For Actions' },
  { key: 'recognizes_problems_develops_solutions', label: 'Recognizes Potential Problems And Develops Solutions' },
  { key: 'demonstrates_problem_solving_skills', label: 'Demonstrates Problem Solving Skills' },
  { key: 'offers_constructive_suggestions', label: 'Offers Constructive Suggestions For Improvement' },
  { key: 'generates_creative_ideas', label: 'Generates Creative Ideas And Solutions' },
  { key: 'provides_alternatives', label: 'Provides Alternatives When Making Recommendations' },
] as const;

export const RATING_KEYS = RATING_CRITERIA.map(c => c.key) as [string, ...string[]];

const ratingsSchema = z.record(z.enum(RATING_KEYS), z.number().int().min(1).max(5)).default({});

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

export const createPerformanceReviewSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: ymdDate,
  periodEnd: ymdDate,
  salutation: z.string().max(20).optional().nullable(),
  employeeNumber: z.string().max(60).optional().nullable(),
  titlePayrollTitle: z.string().max(200).optional().nullable(),
  employeeType: z.string().max(200).optional().nullable(),
  supervisorName: z.string().max(200).optional().nullable(),
  supervisedFullPeriod: z.boolean().optional().default(true),
  supervisedMonths: z.number().int().min(0).max(120).optional().nullable(),
  jobRelatedPerformance: z.string().max(10000).optional().nullable(),
  overallEvaluation: z.string().max(10000).optional().nullable(),
  ratings: ratingsSchema,
  jobFunction: z.string().max(200).optional().nullable(),
  weightPercent: z.number().min(0).max(100).optional().default(100),
  statusGoal: z.string().max(200).optional().nullable(),
  completePercent: z.number().min(0).max(100).optional().default(100),
  performanceEvaluation: z.string().max(10000).optional().nullable(),
  futureGoals: z.string().max(10000).optional().nullable(),
  employeeSignedDate: ymdDate.optional().nullable(),
  supervisorSignedDate: ymdDate.optional().nullable(),
});

export const updatePerformanceReviewSchema = createPerformanceReviewSchema.partial().omit({ employeeId: true });

export const listPerformanceReviewsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['draft', 'sent']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const sendPerformanceReviewSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;
export type UpdatePerformanceReviewInput = z.infer<typeof updatePerformanceReviewSchema>;
export type ListPerformanceReviewsQuery = z.infer<typeof listPerformanceReviewsQuerySchema>;
export type SendPerformanceReviewInput = z.infer<typeof sendPerformanceReviewSchema>;
