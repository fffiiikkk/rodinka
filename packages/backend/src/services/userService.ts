import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';
import type { CreateUserInput, UpdateUserInput, AdminUpdateUserInput } from '@rodinkal/shared';
import argon2 from 'argon2';
import { activityService } from './activityService.js';
import { fileUrl } from '../lib/s3.js';

function resolvePhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  // New S3-style keys look like "photos/abc123.jpg"
  // Legacy local paths start with "./" or "/" — keep serving via /api/files
  return fileUrl(photoPath);
}

function serializeUser(user: {
  id: string; username: string; name: string; email: string; mobile: string | null;
  dateOfBirth: Date | null; role: string; photoPath: string | null;
  preferredLanguage: string; theme: string; colorMode: string;
  isActive: boolean; createdAt: Date; relationship?: string | null; nickname?: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
    role: user.role,
    photoUrl: resolvePhotoUrl(user.photoPath),
    preferredLanguage: user.preferredLanguage,
    theme: user.theme,
    colorMode: user.colorMode,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    relationship: user.relationship ?? null,
    nickname: user.nickname ?? null,
  };
}

const SELECT = {
  id: true, username: true, name: true, email: true, mobile: true,
  dateOfBirth: true, role: true, photoPath: true, preferredLanguage: true,
  theme: true, colorMode: true, isActive: true, createdAt: true,
  relationship: true, nickname: true,
};

export const userService = {
  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: SELECT });
    if (!user) throw createError(404, 'User not found', 'NOT_FOUND');
    return serializeUser(user);
  },

  async listAll(page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { username: { not: 'system' } },
        select: SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where: { username: { not: 'system' } } }),
    ]);
    return { items: items.map(serializeUser), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async listByRole(role: string) {
    const users = await prisma.user.findMany({
      where: { role: role as any, isActive: true },
      select: SELECT,
      orderBy: { name: 'asc' },
    });
    return users.map(serializeUser);
  },

  async listActive() {
    const users = await prisma.user.findMany({
      where: { isActive: true, username: { not: 'system' } },
      select: SELECT,
      orderBy: { name: 'asc' },
    });
    return users.map(serializeUser);
  },

  async create(data: CreateUserInput, creatorId: string) {
    const passwordHash = await argon2.hash(data.password);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        role: data.role,
        preferredLanguage: data.preferredLanguage ?? 'CS',
        theme: data.theme ?? 'klasika',
        colorMode: data.colorMode ?? 'SYSTEM',
      },
      select: SELECT,
    });

    await prisma.auditLog.create({
      data: { userId: creatorId, targetId: user.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id },
    });

    return serializeUser(user);
  },

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth !== undefined
          ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null)
          : undefined,
      },
      select: SELECT,
    });
    await activityService.log(id, 'PROFILE_UPDATED');
    return serializeUser(user);
  },

  async adminUpdate(id: string, data: AdminUpdateUserInput, adminId: string) {
    const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: SELECT });
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth !== undefined
          ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null)
          : undefined,
      },
      select: SELECT,
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId, targetId: id, action: 'USER_UPDATED',
        entityType: 'User', entityId: id,
        diff: { before: serializeUser(before), after: serializeUser(user) },
      },
    });

    return serializeUser(user);
  },

  async updatePhoto(id: string, photoPath: string) {
    await prisma.user.update({ where: { id }, data: { photoPath } });
    await activityService.log(id, 'PROFILE_UPDATED', { action: 'photo_uploaded' });
  },

  async delete(id: string, adminId: string) {
    if (id === adminId) throw createError(400, 'Nemůžeš smazat vlastní účet', 'SELF_DELETE');

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw createError(404, 'User not found', 'NOT_FOUND');
    if (user.username === 'system') throw createError(403, 'System user cannot be deleted', 'FORBIDDEN');

    const suffix = id.slice(-8);

    // Anonymise personal data instead of hard-deleting (preserves event history)
    await prisma.user.update({
      where: { id },
      data: {
        name: 'Smazaný uživatel',
        username: `deleted_${suffix}`,
        email: `deleted_${suffix}@deleted.local`,
        mobile: null,
        photoPath: null,
        dateOfBirth: null,
        nickname: null,
        relationship: null,
        isActive: false,
      },
    });

    // Remove genuinely personal, non-historical data
    await prisma.availability.deleteMany({ where: { userId: id } });
    await prisma.pushSubscription.deleteMany({ where: { userId: id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } });

    await prisma.auditLog.create({
      data: {
        userId: adminId, targetId: id, action: 'USER_DELETED',
        entityType: 'User', entityId: id,
        diff: { deletedName: user.name, deletedUsername: user.username },
      },
    });
  },

  async updateTheme(id: string, theme: string, colorMode: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.user.update({ where: { id }, data: { theme: theme as any, colorMode: colorMode as any } });
    await activityService.log(id, 'THEME_CHANGED', { theme, colorMode });
  },

  async getIcsToken(id: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { icsToken: true } });
    return user.icsToken;
  },

  async regenerateIcsToken(id: string): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    const newToken = uuidv4();
    await prisma.user.update({ where: { id }, data: { icsToken: newToken } });
    return newToken;
  },
};
