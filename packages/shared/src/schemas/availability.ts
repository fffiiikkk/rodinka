import { z } from 'zod';

export const AvailabilityStatusSchema = z.enum(['AVAILABLE', 'UNAVAILABLE', 'ON_CALL']);

export const AvailabilitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userPhotoUrl: z.string().nullable(),
  userColor: z.string().nullable(),   // derived hex color for avatar
  dateFrom: z.string(),
  dateTo: z.string(),
  status: AvailabilityStatusSchema,
  location: z.string().nullable(),
  note: z.string().nullable(),
  isExternal: z.boolean(),
  externalName: z.string().nullable(),
  externalRole: z.string().nullable(),
  createdAt: z.string(),
});

export const CreateAvailabilitySchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  status: AvailabilityStatusSchema,
  location: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  // External coverage (admin-only)
  isExternal: z.boolean().optional(),
  externalName: z.string().max(100).optional(),
  externalRole: z.string().max(100).optional(),
});

export const UpdateAvailabilitySchema = CreateAvailabilitySchema.partial();

export const AvailabilityQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().optional(),
});

export const CoverageGapSchema = z.object({
  date: z.string(),
  events: z.array(z.object({
    id: z.string(),
    title: z.string(),
    participantNames: z.array(z.string()),
  })),
  availableGuardians: z.array(z.string()),
});

export type Availability = z.infer<typeof AvailabilitySchema>;
export type CreateAvailabilityInput = z.infer<typeof CreateAvailabilitySchema>;
export type UpdateAvailabilityInput = z.infer<typeof UpdateAvailabilitySchema>;
export type CoverageGap = z.infer<typeof CoverageGapSchema>;
