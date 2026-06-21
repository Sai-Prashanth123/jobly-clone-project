import { z } from 'zod';

export const createCycleSchema = z.object({
  name:               z.string().min(1).max(200),
  description:        z.string().max(2000).optional().nullable(),
  reviewType:         z.enum(['annual','quarterly','project','probation']).default('annual'),
  selfAssessmentDue:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  peerFeedbackDue:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  managerReviewDue:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateCycleSchema = createCycleSchema.partial();

export const addParticipantSchema = z.object({
  employeeId: z.string().uuid(),
  managerId:  z.string().uuid().optional().nullable(),
});

export const selfAssessmentSchema = z.object({
  strengths:    z.string().max(5000).optional().nullable(),
  improvements: z.string().max(5000).optional().nullable(),
  goals:        z.string().max(5000).optional().nullable(),
  rating:       z.number().int().min(1).max(5).optional().nullable(),
});

export const managerReviewSchema = z.object({
  employeeId:   z.string().uuid(),
  rating:       z.number().int().min(1).max(5).optional().nullable(),
  strengths:    z.string().max(5000).optional().nullable(),
  improvements: z.string().max(5000).optional().nullable(),
  goals:        z.string().max(5000).optional().nullable(),
});

export const nominatePeersSchema = z.object({
  peerEmployeeIds: z.array(z.string().uuid()).min(1).max(10),
});

export const submitPeerFeedbackSchema = z.object({
  rating:       z.number().int().min(1).max(5).optional().nullable(),
  strengths:    z.string().max(5000).optional().nullable(),
  improvements: z.string().max(5000).optional().nullable(),
});

export type CreateCycleInput        = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput        = z.infer<typeof updateCycleSchema>;
export type AddParticipantInput     = z.infer<typeof addParticipantSchema>;
export type SelfAssessmentInput     = z.infer<typeof selfAssessmentSchema>;
export type ManagerReviewInput      = z.infer<typeof managerReviewSchema>;
export type NominatePeersInput      = z.infer<typeof nominatePeersSchema>;
export type SubmitPeerFeedbackInput = z.infer<typeof submitPeerFeedbackSchema>;
