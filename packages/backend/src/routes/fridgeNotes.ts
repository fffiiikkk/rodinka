import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

const uploadDir = path.join(config.uploadDir, 'fridge-notes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMES.includes(file.mimetype));
  },
});

/** GET / — active (non-expired) notes, pinned first then newest */
router.get('/', async (_req, res, next) => {
  try {
    const notes = await prisma.fridgeNote.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, name: true, nickname: true, photoPath: true, role: true } },
        attachments: true,
      },
    });
    res.json({ notes });
  } catch (e) { next(e); }
});

/** POST / — create a note */
router.post('/', async (req, res, next) => {
  try {
    const { contentHtml, color, expiresAt } = req.body as {
      contentHtml?: string;
      color?: string;
      expiresAt?: string;
    };
    if (!contentHtml?.trim()) { res.status(400).json({ error: 'contentHtml required' }); return; }

    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 14);

    const note = await prisma.fridgeNote.create({
      data: {
        authorId: req.session.userId!,
        contentHtml,
        color: color ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiry,
      },
      include: {
        author: { select: { id: true, name: true, nickname: true, photoPath: true, role: true } },
        attachments: true,
      },
    });
    res.json({ note });
  } catch (e) { next(e); }
});

/** PATCH /:id — author or admin */
router.patch('/:id', async (req, res, next) => {
  try {
    const note = await prisma.fridgeNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw createError(404, 'Vzkaz nenalezen', 'NOT_FOUND');
    const isOwner = note.authorId === req.session.userId;
    const isAdmin = req.session.role === 'PARENT';
    if (!isOwner && !isAdmin) throw createError(403, 'Nedostatečná oprávnění', 'FORBIDDEN');

    const { contentHtml, color, isPinned, expiresAt } = req.body as {
      contentHtml?: string;
      color?: string;
      isPinned?: boolean;
      expiresAt?: string | null;
    };

    const updated = await prisma.fridgeNote.update({
      where: { id: req.params.id },
      data: {
        ...(contentHtml !== undefined && { contentHtml }),
        ...(color !== undefined && { color }),
        ...(isPinned !== undefined && { isPinned }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
      include: {
        author: { select: { id: true, name: true, nickname: true, photoPath: true, role: true } },
        attachments: true,
      },
    });
    res.json({ note: updated });
  } catch (e) { next(e); }
});

/** DELETE /:id — author or admin */
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await prisma.fridgeNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw createError(404, 'Vzkaz nenalezen', 'NOT_FOUND');
    const isOwner = note.authorId === req.session.userId;
    const isAdmin = req.session.role === 'PARENT';
    if (!isOwner && !isAdmin) throw createError(403, 'Nedostatečná oprávnění', 'FORBIDDEN');

    await prisma.fridgeNote.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** POST /:id/attachments — upload attachment to a note */
router.post('/:id/attachments', upload.single('file'), async (req, res, next) => {
  try {
    const note = await prisma.fridgeNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw createError(404, 'Vzkaz nenalezen', 'NOT_FOUND');
    const isOwner = note.authorId === req.session.userId;
    const isAdmin = req.session.role === 'PARENT';
    if (!isOwner && !isAdmin) throw createError(403, 'Nedostatečná oprávnění', 'FORBIDDEN');
    if (!req.file) throw createError(400, 'Soubor je povinný', 'VALIDATION_ERROR');

    const storageKey = `fridge-notes/${req.file.filename}`;

    // Generate thumbnail for images
    if (req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/gif') {
      try {
        const thumbName = `thumb-${req.file.filename}`;
        await sharp(req.file.path)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(path.join(uploadDir, thumbName));
      } catch {
        // thumbnail failure is non-fatal
      }
    }

    const attachment = await prisma.fridgeNoteAttachment.create({
      data: {
        noteId: req.params.id!,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storageKey,
      },
    });
    res.json({ attachment });
  } catch (e) { next(e); }
});

export default router;
