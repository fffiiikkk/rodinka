import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  appUrl: optional('APP_URL', 'http://localhost:3000'),
  appVersion: optional('APP_VERSION', 'local'),

  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),

  resendApiKey: optional('RESEND_API_KEY', ''),
  emailFrom: optional('EMAIL_FROM', 'kalendar@family.local'),

  vapidPublicKey: optional('VAPID_PUBLIC_KEY', ''),
  vapidPrivateKey: optional('VAPID_PRIVATE_KEY', ''),
  vapidSubject: optional('VAPID_SUBJECT', 'mailto:admin@family.local'),

  uploadDir: optional('UPLOAD_DIR', './uploads'),
  uploadMaxSizeMb: parseInt(optional('UPLOAD_MAX_SIZE_MB', '20'), 10),

  // S3 (optional — falls back to local disk when S3_BUCKET is not set)
  s3Bucket: optional('S3_BUCKET', ''),
  s3Region: optional('AWS_REGION', 'us-east-1'),
  s3Prefix: optional('S3_PREFIX', 'rodinny-kalendar/uploads'),

  logLevel: optional('LOG_LEVEL', 'info'),

  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',
} as const;
