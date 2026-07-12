import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { createError } from '../middleware/errorHandler.js';
import { activityService } from '../services/activityService.js';
import { badgeService } from '../services/badgeService.js';

const router = Router();
router.use(requireAuth);

const uploadDir = path.join(config.uploadDir, 'attachments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMES.includes(file.mimetype));
  },
});

router.post('/event/:eventId', upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.flags['attachments']) {
      res.status(403).json({ error: 'Attachments feature is disabled', code: 'FEATURE_DISABLED' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files?.length) throw createError(400, 'No files uploaded', 'NO_FILE');

    const eventId = req.params['eventId'] as string;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw createError(404, 'Event not found', 'NOT_FOUND');

    const created = [];
    for (const file of files) {
      let thumbnailPath: string | undefined;

      // Generate thumbnail for images
      if (file.mimetype.startsWith('image/')) {
        thumbnailPath = file.path.replace(/(\.[^.]+)$/, '-thumb$1');
        await sharp(file.path)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .toFile(thumbnailPath);
      }

      const attachment = await prisma.eventAttachment.create({
        data: {
          eventId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath: file.path,
          thumbnailPath,
          uploadedById: req.user!.id,
        },
      });
      created.push(attachment);
    }

    await activityService.log(req.user!.id, 'ATTACHMENT_UPLOADED', { eventId, count: created.length });
    void badgeService.evaluateForUser(req.user!.id);

    res.status(201).json({
      attachments: created.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        downloadUrl: `${config.appUrl}/api/attachments/${a.id}/file`,
        thumbnailUrl: a.thumbnailPath ? `${config.appUrl}/api/attachments/${a.id}/thumbnail` : null,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (e) { next(e); }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const attachment = await prisma.eventAttachment.findUnique({ where: { id: req.params['id'] as string } });
    if (!attachment) throw createError(404, 'Attachment not found', 'NOT_FOUND');
    res.download(path.resolve(attachment.storagePath), attachment.fileName);
  } catch (e) { next(e); }
});

router.get('/:id/thumbnail', async (req, res, next) => {
  try {
    const attachment = await prisma.eventAttachment.findUnique({ where: { id: req.params['id'] as string } });
    if (!attachment?.thumbnailPath) throw createError(404, 'Thumbnail not found', 'NOT_FOUND');
    res.sendFile(path.resolve(attachment.thumbnailPath));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const attachment = await prisma.eventAttachment.findUnique({ where: { id: req.params['id'] as string } });
    if (!attachment) throw createError(404, 'Attachment not found', 'NOT_FOUND');
    if (attachment.uploadedById !== req.user!.id && req.user!.role !== 'PARENT') {
      throw createError(403, 'Forbidden', 'FORBIDDEN');
    }

    // Delete files from disk
    [attachment.storagePath, attachment.thumbnailPath].forEach((p) => {
      if (p) fs.unlink(path.resolve(p), () => {});
    });

    await prisma.eventAttachment.delete({ where: { id: req.params['id'] as string } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
