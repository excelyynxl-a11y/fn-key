import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import emailRoutes from './routes/emailRoutes.js';
import runRoutes from './routes/runRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors({ 
    origin: process.env.CLIENT_ORIGIN || 
    'http://localhost:5173' 
  }));

  app.use(express.json());

  app.get('/', (_req, res) => res.json({
    data: { service: 'sdoc-api', message: 'API is running' },
    error: null,
    meta: {}
  }));

  app.get('/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    
    res.status(connected ? 200 : 503).json({ 
      status: connected ? 'ok' : 'unavailable' 
    });
  });

  app.use('/api/runs', runRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/knowledge', knowledgeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
