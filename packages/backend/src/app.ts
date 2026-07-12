import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { flagMiddleware } from './middleware/flagMiddleware.js';
import { userMiddleware } from './middleware/userMiddleware.js';

import authRouter from './routes/auth.js';
import filesRouter from './routes/files.js';
import calendarLayerRouter from './routes/calendarLayer.js';
import usersRouter from './routes/users.js';
import eventsRouter from './routes/events.js';
import eventTypesRouter from './routes/eventTypes.js';
import availabilityRouter from './routes/availability.js';
import badgesRouter from './routes/badges.js';
import reportsRouter from './routes/reports.js';
import flagsRouter from './routes/flags.js';
import motdRouter from './routes/motd.js';
import attachmentsRouter from './routes/attachments.js';
import notificationsRouter from './routes/notifications.js';
import icsRouter from './routes/ics.js';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  app.use(cors({
    origin: config.isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : config.appUrl,
    credentials: true,
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(pinoHttp({
    logger,
    genReqId: () => uuidv4(),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }));

  app.use(session({
    store: new PgSession({
      conString: config.databaseUrl,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }));

  app.use(flagMiddleware());
  app.use(userMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: config.appVersion,
      environment: config.nodeEnv,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/calendar-layer', calendarLayerRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/event-types', eventTypesRouter);
  app.use('/api/availability', availabilityRouter);
  app.use('/api/badges', badgesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/flags', flagsRouter);
  app.use('/api/motd', motdRouter);
  app.use('/api/attachments', attachmentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/ics', icsRouter);

  // Serve frontend build in production (frontend builds into backend/dist/public)
  if (config.isProduction) {
    const frontendDist = path.resolve(__dirname, '..', 'public');
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
