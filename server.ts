import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './src/server/routes.ts';
import { startTelegramLongPolling } from './src/server/telegramBot.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // JSON Body parsing with 15MB limit for photo uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Mount API router
  app.use('/api', apiRouter);

  // Direct root level Telegram webhook handlers (in addition to /api/telegram/webhook)
  app.post(['/telegram/webhook', '/bot/webhook', '/webhook'], async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN topilmadi' });
      const { handleTelegramUpdate } = await import('./src/server/telegramBot.ts');
      const update = req.body;
      if (update && (update.message || update.callback_query)) {
        await handleTelegramUpdate(update, token);
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[Root Telegram Webhook Error]:', err.message);
      res.status(200).json({ ok: true });
    }
  });

  // Catch-all for undefined /api routes so they NEVER fall through to Vite SPA HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API yo'nalishi topilmadi: ${req.method} ${req.path}` });
  });

  // Global API error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error('API Error:', err);
      return res.status(500).json({ error: err.message || 'Server ichki xatoligi' });
    }
    next(err);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', platform: 'Mahalla One', timestamp: new Date() });
  });

  // Serve Frontend via Vite middleware in Dev, or static files in Prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Mahalla One] Server listening on http://0.0.0.0:${PORT}`);
    // Start Telegram Bot Long Polling for real-time updates
    startTelegramLongPolling();
  });
}

startServer().catch((err) => {
  console.error('Failed to start Mahalla One server:', err);
  process.exit(1);
});
