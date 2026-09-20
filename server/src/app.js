import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());
  app.get('/', (_req, res) => res.json({ message: 'API is running' }));
  app.get('/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
  });
  return app;
}
