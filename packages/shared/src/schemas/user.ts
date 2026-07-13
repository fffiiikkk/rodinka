import { z } from 'zod';

export const RoleSchema = z.enum(['PARENT', 'GRANDPARENT', 'RELATIVE', 'KID', 'GUEST']);
export const LanguageSchema = z.enum(['CS', 'EN']);
export const ColorModeSchema = z.enum(['LIGHT', 'DARK', 'SYSTEM']);
export const ThemeSchema = z.enum(['klasika', 'ocean', 'led', 'leto', 'les']);

export const UserPublicSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string().email(),
  mobile: z.string().nullable(),
  dateOfBirth: z.string().nullable(), // UTC ISO string
  role: RoleSchema,
  photoUrl: z.string().nullable(),
  preferredLanguage: LanguageSchema,
  theme: ThemeSchema,
  colorMode: ColorModeSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  isImpersonating: z.boolean().optional(),
  relationship: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, _ and - allowed'),
  password: z
    .string()
    .min(8)
    .max(200)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  mobile: z.string().max(20).optional(),
  dateOfBirth: z.string().datetime().optional(),
  role: RoleSchema,
  preferredLanguage: LanguageSchema.default('CS'),
  theme: ThemeSchema.default('klasika'),
  colorMode: ColorModeSchema.default('SYSTEM'),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  mobile: z.string().max(20).nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  preferredLanguage: LanguageSchema.optional(),
  theme: ThemeSchema.optional(),
  colorMode: ColorModeSchema.optional(),
  relationship: z.string().max(100).nullable().optional(),
  nickname: z.string().max(60).nullable().optional(),
});

export const AdminUpdateUserSchema = UpdateUserSchema.extend({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, _ and - allowed').optional(),
  role: RoleSchema.optional(),
  isActive: z.boolean().optional(),
  relationship: z.string().max(100).nullable().optional(),
  nickname: z.string().max(60).nullable().optional(),
});

export type UserPublic = z.infer<typeof UserPublicSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;
