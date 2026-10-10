import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { attachUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { apiRouter } from './routes';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(attachUser);

  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler);

  // Serve the built SPA when it exists; API paths above already handled it.
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}