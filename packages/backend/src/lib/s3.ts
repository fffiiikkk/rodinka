import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

// ─── S3 client (lazy — only constructed when bucket is configured) ────────────
let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({ region: config.s3Region });
  }
  return _s3;
}

export function isS3Enabled(): boolean {
  return !!config.s3Bucket;
}

/** Generate a unique file key: `<prefix>/<8-hex>.<ext>` */
export function generateKey(prefix: string, originalname: string): string {
  const ext = path.extname(originalname).toLowerCase() || '.bin';
  const hash = randomBytes(8).toString('hex');
  return `${prefix}/${hash}${ext}`;
}

/** Full S3 object key (bucket prefix + file key). */
function s3ObjectKey(fileKey: string): string {
  const prefix = config.s3Prefix.replace(/\/+$/, '');
  return `${prefix}/${fileKey}`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/** Upload buffer to S3. Returns the file key (not the full S3 key). */
export async function putToS3(
  fileKey: string,
  data: Buffer,
  mimeType: string,
): Promise<string> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: s3ObjectKey(fileKey),
      Body: data,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
      ServerSideEncryption: 'AES256',
    }),
  );
  return fileKey;
}

/** Fetch a file from S3 by its file key. */
export async function getFromS3(fileKey: string): Promise<{ data: Buffer; mimeType: string }> {
  const response = await getS3().send(
    new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: s3ObjectKey(fileKey),
    }),
  );
  if (!response.Body) throw new Error('Empty S3 response');
  const bytes = await response.Body.transformToByteArray();
  return {
    data: Buffer.from(bytes),
    mimeType: response.ContentType ?? 'application/octet-stream',
  };
}

// ─── Local fallback (dev without S3) ─────────────────────────────────────────

function localPath(fileKey: string): string {
  return path.join(config.uploadDir, fileKey.replace(/\//g, '_'));
}

export async function putLocally(fileKey: string, data: Buffer, mimeType: string): Promise<string> {
  const filePath = localPath(fileKey);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, data);
  return fileKey;
}

export async function getLocally(fileKey: string): Promise<{ data: Buffer; mimeType: string }> {
  const filePath = localPath(fileKey);
  if (!fs.existsSync(filePath)) throw new Error('File not found locally');
  return {
    data: fs.readFileSync(filePath),
    mimeType: guessMimeType(fileKey),
  };
}

function guessMimeType(fileKey: string): string {
  const ext = path.extname(fileKey).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ─── Unified helpers ──────────────────────────────────────────────────────────

/** Save a file to S3 (or local in dev). Returns the file key. */
export async function saveFile(
  fileKey: string,
  data: Buffer,
  mimeType: string,
): Promise<string> {
  if (isS3Enabled()) return putToS3(fileKey, data, mimeType);
  return putLocally(fileKey, data, mimeType);
}

/** Retrieve a file from S3 (or local in dev). */
export async function getFile(fileKey: string): Promise<{ data: Buffer; mimeType: string }> {
  if (isS3Enabled()) return getFromS3(fileKey);
  return getLocally(fileKey);
}

/** Public URL path for a stored file. */
export function fileUrl(fileKey: string): string {
  return `/api/files/${encodeURIComponent(fileKey)}`;
}
