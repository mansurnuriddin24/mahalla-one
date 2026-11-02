import express from 'express';
import apiRouter from '../src/server/routes.ts';

const app = express();

// Increase JSON body payload size for photo uploads and media
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mount API router on both /api and root to guarantee all Vercel rewrite paths match
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Vercel Serverless API Error]:', err);
  res.status(500).json({ error: err.message || 'Server ichki xatoligi yuz berdi' });
});

export default app;
