import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { resolveChurchTenant } from './middleware/churchTenant';
import { createSocketServer } from './socket';
import { uploadsRoot } from './middleware/upload';
import { startReminderJob } from './jobs/reminderJob';

import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import attendanceRoutes from './routes/attendance';
import financeRoutes from './routes/finance';
import eventsRoutes from './routes/events';
import announcementsRoutes from './routes/announcements';
import departmentsRoutes from './routes/departments';
import marketplaceRoutes from './routes/marketplace';
import publicRoutes from './routes/public';
import superadminRoutes from './routes/superadmin';
import notificationRoutes from './routes/notifications';
import chatRoutes from './routes/chat';
import usersRoutes from './routes/users';
import auditRoutes from './routes/audit';
import churchPageRoutes, { publicJoinHandler } from './routes/churchPage';
import dashboardRoutes from './routes/dashboard';
import pastoralRoutes from './routes/pastoral';
import churchLifeRoutes from './routes/churchLife';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

/** Localhost (any port) + christnerve / ch-* production hosts */
const productionOriginPattern =
  /^https:\/\/(christnerve|ch-[a-z0-9-]+)\.scholarnerve\.com$/i;

function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return true;
  if (origin === frontendUrl) return true;

  const isLocalhost =
    origin.includes('localhost') || origin.includes('127.0.0.1');
  const isProduction = productionOriginPattern.test(origin);

  if (isLocalhost || isProduction) return true;
  return false;
}

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // Allow <img> / font loads from the Vite origin (5174) and tenant hosts
    // when media is served from the API origin (5001) or a separate uploads host.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

export const io = createSocketServer(httpServer, isAllowedOrigin);

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadsRoot));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'christnerve-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'christnerve-api',
    timestamp: new Date().toISOString(),
  });
});

app.use(resolveChurchTenant);

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/market', marketplaceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/church-page', churchPageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pastoral', pastoralRoutes);
app.use('/api/church-life', churchLifeRoutes);
app.post('/api/public/church/:slug/join', publicJoinHandler);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack || err.message);
    if (err.message?.includes('Only JPEG') || err.message === 'Not allowed by CORS') {
      res.status(err.message === 'Not allowed by CORS' ? 403 : 400).json({
        error: err.message,
      });
      return;
    }
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  }
);

const PORT = parseInt(process.env.PORT || '5001', 10);
const listenHost = isProd ? '127.0.0.1' : '0.0.0.0';

httpServer.listen(PORT, listenHost, () => {
  console.log(`ChristNerve API running on ${listenHost}:${PORT}`);
  startReminderJob();
});
