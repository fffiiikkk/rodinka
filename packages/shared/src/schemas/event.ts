import { z } from 'zod';

export const EventStatusSchema = z.enum(['PROPOSED', 'APPROVED', 'CANCELLED']);

export const EventTypePublicSchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameCs: z.string(),
  nameEn: z.string(),
  icon: z.string(),
  color: z.string(),
  groupCs: z.string(),
  groupEn: z.string(),
  defaultDurationMinutes: z.number(),
  defaultReminderMinutes: z.number(),
  sortOrder: z.number(),
  isActive: z.boolean(),
});

export const EventAttachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  thumbnailUrl: z.string().nullable(),
  downloadUrl: z.string(),
  createdAt: z.string(),
});

export const EventParticipantSchema = z.object({
  userId: z.string(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  role: z.string(),
});

export const TransportSchema = z.object({
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userRole: z.string().nullable(),
  externalName: z.string().nullable(),
  note: z.string().nullable(),
  // BOTH | THERE | BACK — which direction the transport covers (null = BOTH)
  direction: z.enum(['BOTH', 'THERE', 'BACK']).nullable(),
  // null = assumed covers supervision when transporter set, false = does NOT cover supervision
  coversSupervision: z.boolean().nullable(),
});

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  eventTypeId: z.string().nullable(),
  eventType: EventTypePublicSchema.nullable(),
  start: z.string(), // UTC ISO
  end: z.string(),   // UTC ISO
  allDay: z.boolean(),
  location: z.string().nullable(),
  colorOverride: z.string().nullable(),
  createdById: z.string(),
  recurrenceRule: z.string().nullable(),
  parentEventId: z.string().nullable(),
  status: EventStatusSchema,
  isHoliday: z.boolean(),
  transport: TransportSchema.nullable(),
  participants: z.array(EventParticipantSchema),
  attachments: z.array(EventAttachmentSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  eventTypeId: z.string().optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  allDay: z.boolean().default(false),
  location: z.string().max(200).optional(),
  colorOverride: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  recurrenceRule: z.string().max(500).optional(),
  parentEventId: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
  // Transport
  transportUserId: z.string().optional(),
  transportExternalName: z.string().max(100).optional(),
  transportNote: z.string().max(300).optional(),
  transportDirection: z.enum(['BOTH', 'THERE', 'BACK']).optional(),
  transportCoversSupervision: z.boolean().optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export const EventQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().optional(),
  eventTypeId: z.string().optional(),
  status: EventStatusSchema.optional(),
  includeHolidays: z.coerce.boolean().default(true),
  expandRecurring: z.coerce.boolean().default(true),
});

export const CreateEventTypeSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  nameCs: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  icon: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  groupCs: z.string().min(1).max(100),
  groupEn: z.string().min(1).max(100),
  defaultDurationMinutes: z.number().int().min(5).max(1440).default(60),
  defaultReminderMinutes: z.number().int().min(0).max(10080).default(60),
  sortOrder: z.number().int().default(0),
});

export type EventType = z.infer<typeof EventTypePublicSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Transport = z.infer<typeof TransportSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type EventQuery = z.infer<typeof EventQuerySchema>;
export type CreateEventTypeInput = z.infer<typeof CreateEventTypeSchema>;
