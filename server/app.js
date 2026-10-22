import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { licenseGuard } from './middleware/license.js';
import auditRoutes from './routes/audit.js';
import authRoutes from './routes/auth.js';
import backupRoutes from './routes/backups.js';
import dashboardRoutes from './routes/dashboard.js';
import licenseRoutes from './routes/license.js';
import metaRoutes from './routes/meta.js';
import printTemplateRoutes from './routes/printTemplates.js';
import productRoutes from './routes/products.js';
import publicRoutes from './routes/public.js';
import repairRoutes from './routes/repairs.js';
import returnRoutes from './routes/returns.js';
import settingsRoutes from './routes/settings.js';
import setupRoutes from './routes/setup.js';
import upgradeRoutes from './routes/upgrade.js';
import userRoutes from './routes/users.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const started = Date.now();
    res.on('finish', () => {
      logger.info('http', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - started,
        ip: req.ip,
      });
    });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), version: config.appVersion });
  });

  app.use('/api/setup', setupRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/license', licenseRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/users', licenseGuard, userRoutes);
  app.use('/api/products', licenseGuard, productRoutes);
  app.use('/api/print-templates', licenseGuard, printTemplateRoutes);
  app.use('/api/repairs', licenseGuard, repairRoutes);
  app.use('/api/returns', licenseGuard, returnRoutes);
  app.use('/api/dashboard', licenseGuard, dashboardRoutes);
  app.use('/api/audit-logs', licenseGuard, auditRoutes);
  app.use('/api/backups', backupRoutes);
  app.use('/api/upgrade', upgradeRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在' });
  });

  const indexFile = path.join(config.publicDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(
      express.static(config.publicDir, {
        index: false,
        maxAge: '1h',
      }),
    );
    app.get('*', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.sendFile(indexFile);
    });
  } else {
    app.get('/', (req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('前端尚未构建。开发模式请访问 Vite 地址（默认 http://localhost:5173），或运行 npm run build。');
    });
  }

  app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: '页面不存在' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ code: 'INVALID_JSON', message: '请求内容不是有效的 JSON' });
    }

    if (error instanceof AppError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }

    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ code: 'DUPLICATE', message: '数据已存在，请勿重复提交' });
    }

    logger.error('unhandled error', {
      path: req.originalUrl,
      method: req.method,
      message: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务器内部错误，请稍后重试' });
  });

  return app;
}
