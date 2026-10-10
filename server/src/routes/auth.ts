import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, unauthenticated } from '../errors';
import { hashPassword, verifyPassword } from '../password';
import { publicUser } from '../serialize';
import {
  clearSessionCookie,
  setSessionCookie,
} from '../middleware/auth';
import {
  createSession,
  createUser,
  destroySession,
  getUserByEmail,
} from '../store';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

const signupSchema = credentials.extend({
  name: z.string().trim().min(1).max(80),
});

export const authRouter = Router();

authRouter.post('/signup', (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid signup details', parsed.error.flatten()));
  }
  const { email, password, name } = parsed.data;
  if (getUserByEmail(email)) {
    return next(conflict('An account with that email already exists'));
  }
  const user = createUser({ email, name, passwordHash: hashPassword(password) });
  const session = createSession(user.id);
  setSessionCookie(res, session.token);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', (req, res, next) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid login details', parsed.error.flatten()));
  }
  const { email, password } = parsed.data;
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return next(unauthenticated('Invalid email or password'));
  }
  const session = createSession(user.id);
  setSessionCookie(res, session.token);
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  destroySession(res.locals.session?.token);
  clearSessionCookie(res);
  res.status(204).end();
});
