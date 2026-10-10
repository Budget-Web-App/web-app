import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import { budgetView, memberView } from '../serialize';
import {
  countOwners,
  createBudget,
  deleteBudget,
  getBudget,
  getUserByEmail,
  getUserById,
  listMembershipsForBudget,
  listMembershipsForUser,
  removeMembership,
  setMembership,
} from '../store';
import type { Budget, Membership, Role, User } from '../types';
import { accountsRouter } from './accounts';
import { categoriesRouter, categoryGroupsRouter } from './categories';
import { monthsRouter } from './months';
import { syncRouter } from './sync';
import { transactionsRouter } from './transactions';

const ROLE_VALUES: Role[] = ['owner', 'editor', 'viewer'];

const nameSchema = z.string().trim().min(1).max(60);
const createSchema = z.object({
  name: nameSchema,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default('USD'),
});
const roleSchema = z.object({ role: z.enum(['owner', 'editor', 'viewer']) });
const addMemberSchema = roleSchema.extend({
  email: z.string().trim().toLowerCase().email(),
});

const ROLE_LABEL: Record<Role, string> = {
  owner: 'an owner',
  editor: 'an editor',
  viewer: 'a viewer',
};

export const budgetsRouter = Router();

budgetsRouter.get('/', (req, res) => {
  const user = res.locals.user as User;
  const budgets = listMembershipsForUser(user.id).map((membership) => {
    const budget = getBudget(membership.budgetId);
    return budget ? budgetView(budget, membership.role) : null;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
  res.json({ budgets });
});

budgetsRouter.post('/', (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid budget details', parsed.error.flatten()));
  }
  const user = res.locals.user as User;
  const budget = createBudget({ ...parsed.data, ownerId: user.id });
  res.status(201).json({ budget: budgetView(budget, 'owner') });
});

budgetsRouter.get('/:budgetId', loadBudget, (req, res) => {
  const budget = res.locals.budget as Budget;
  const membership = res.locals.membership as Membership;
  res.json({ budget: budgetView(budget, membership.role) });
});

budgetsRouter.patch(
  '/:budgetId',
  loadBudget,
  requireBudgetRole('editor'),
  (req, res, next) => {
    const parsed = z.object({ name: nameSchema }).safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid budget details', parsed.error.flatten()));
    }
    const budget = res.locals.budget as Budget;
    const membership = res.locals.membership as Membership;
    budget.name = parsed.data.name;
    res.json({ budget: budgetView(budget, membership.role) });
  },
);

budgetsRouter.delete(
  '/:budgetId',
  loadBudget,
  requireBudgetRole('owner'),
  (req, res) => {
    deleteBudget(req.params.budgetId);
    res.status(204).end();
  },
);

budgetsRouter.get('/:budgetId/members', loadBudget, (req, res) => {
  const budgetId = req.params.budgetId;
  const members = listMembershipsForBudget(budgetId)
    .map((membership) => {
      const user = getUserById(membership.userId);
      return user ? memberView(membership, user) : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
  res.json({ members });
});

budgetsRouter.post(
  '/:budgetId/members',
  loadBudget,
  requireBudgetRole('owner'),
  (req, res, next) => {
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid member details', parsed.error.flatten()));
    }
    const user = getUserByEmail(parsed.data.email);
    if (!user) return next(notFound('No user with that email'));
    if (getMembershipOf(res.locals.budget as Budget, user.id)) {
      return next(conflict('That user is already a member'));
    }
    const membership = setMembership(
      (res.locals.budget as Budget).id,
      user.id,
      parsed.data.role,
    );
    res.status(201).json({ member: memberView(membership, user) });
  },
);

budgetsRouter.patch(
  '/:budgetId/members/:userId',
  loadBudget,
  requireBudgetRole('owner'),
  (req, res, next) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid role', parsed.error.flatten()));
    }
    const budgetId = req.params.budgetId;
    const user = getUserById(req.params.userId);
    if (!user) return next(notFound('Member not found'));
    const existing = getMembershipOf(res.locals.budget as Budget, user.id);
    if (!existing) return next(notFound('Member not found'));
    if (
      existing.role === 'owner' &&
      parsed.data.role !== 'owner' &&
      countOwners(budgetId) <= 1
    ) {
      return next(conflict('A budget must keep at least one owner'));
    }
    const membership = setMembership(budgetId, user.id, parsed.data.role);
    res.json({ member: memberView(membership, user) });
  },
);

budgetsRouter.delete(
  '/:budgetId/members/:userId',
  loadBudget,
  requireBudgetRole('owner'),
  (req, res, next) => {
    const user = getUserById(req.params.userId);
    if (!user) return next(notFound('Member not found'));
    const existing = getMembershipOf(res.locals.budget as Budget, user.id);
    if (!existing) return next(notFound('Member not found'));
    if (existing.role === 'owner' && countOwners(req.params.budgetId) <= 1) {
      return next(conflict('A budget must keep at least one owner'));
    }
    removeMembership(req.params.budgetId, user.id);
    res.status(204).end();
  },
);

budgetsRouter.use('/:budgetId/accounts', accountsRouter);
budgetsRouter.use('/:budgetId/category-groups', categoryGroupsRouter);
budgetsRouter.use('/:budgetId/categories', categoriesRouter);
budgetsRouter.use('/:budgetId/months', monthsRouter);
budgetsRouter.use('/:budgetId/transactions', transactionsRouter);
budgetsRouter.use('/:budgetId/sync', syncRouter);

function getMembershipOf(budget: Budget, userId: string) {
  return listMembershipsForBudget(budget.id).find(
    (m) => m.userId === userId,
  );
}