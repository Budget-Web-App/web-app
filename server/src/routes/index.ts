import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { publicUser } from '../serialize';
import type { User } from '../types';
import { authRouter } from './auth';
import { budgetsRouter } from './budgets';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);

apiRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ user: publicUser(res.locals.user as User) });
});

apiRouter.use('/budgets', requireAuth, budgetsRouter);