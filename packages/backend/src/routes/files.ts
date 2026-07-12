import { Router } from 'express';
import { createHash } from 'node:crypto';
import { getFile } from '../lib/s3.js';

const router = Router();

/** Serve any uploaded file (photo, attachment) — proxies S3 or local storage. */
router.get('/:key', async (req, res, next) => {
  try {
    const fileKey = decodeURIComponent(req.params['key'] as string);
    if (!fileKey) { res.status(400).json({ error: 'Missing key' }); return; }

    const { data, mimeType } = await getFile(fileKey);

    const etag = `"${createHash('md5').update(fileKey + data.length).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }

    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(data.length),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      ETag: etag,
    });
    res.send(data);
  } catch (e: any) {
    if (e?.message?.includes('not found') || e?.name === 'NoSuchKey') {
      res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
      return;
    }
    next(e);
  }
});

export default router;
