import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { postsRouter } from './routes/posts.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(postsRouter);
  app.use(errorHandler);

  return app;
}
