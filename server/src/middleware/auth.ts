import type { NextFunction, Request, Response } from 'express';
import { config, isProduction } from '../config';
import { forbidden, notFound, unauthenticated } from '../errors';
import { getBudget, getMembership, getSession, getUserById } from '../store';
import type { Budget, Membership, Role, User } from '../types';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(
      part.slice(index + 1).trim(),
    );
  }
  return cookies;
}

/** Load the session user onto res.locals when a valid session cookie is present. */
export function attachUser(req: Request, res: Response, next: NextFunction) {
  const token = parseCookies(req.headers.cookie)[config.sessionCookie];
  if (token) {
    const session = getSession(token);
    const user = session ? getUserById(session.userId) : undefined;
    if (session && user) {
      res.locals.session = session;
      res.locals.user = user;
    }
  }
  next();
}

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) return next(unauthenticated());
  next();
}

/** Resolve :budgetId and confirm the caller is a member, else 404. */
export function loadBudget(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as User;
  const budget = getBudget(req.params.budgetId);
  const membership = budget
    ? getMembership(budget.id, user.id)
    : undefined;
  if (!budget || !membership) return next(notFound('Budget not found'));
  res.locals.budget = budget;
  res.locals.membership = membership;
  next();
}

export function requireBudgetRole(minimum: Role) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const membership = res.locals.membership as Membership;
    if (RANK[membership.role] < RANK[minimum]) return next(forbidden());
    next();
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: config.sessionTtlMs,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.sessionCookie, { path: '/' });
}

// Re-exported for handlers that only need the types.
export type { Budget, Membership, User };
