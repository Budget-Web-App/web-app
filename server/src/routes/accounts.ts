import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import {
  accountBalanceMinor,
  createAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from '../store';

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['checking', 'savings', 'credit']),
});

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    closed: z.boolean().optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.closed !== undefined, {
    message: 'Provide name or closed',
  });

export const accountsRouter = Router({ mergeParams: true });

accountsRouter.get('/', loadBudget, (req, res) => {
  res.json({
    accounts: listAccounts(req.params.budgetId).map((account) => ({
      ...account,
      balanceMinor: accountBalanceMinor(req.params.budgetId, account.id),
    })),
  });
});

accountsRouter.post('/', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid account details', parsed.error.flatten()));
  }
  const account = createAccount({ budgetId: req.params.budgetId, ...parsed.data });
  res.status(201).json({ account });
});

accountsRouter.patch('/:accountId', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid account details', parsed.error.flatten()));
  }
  const account = getAccount(req.params.budgetId, req.params.accountId);
  if (!account) return next(notFound('Account not found'));
  const updated = updateAccount(req.params.budgetId, account.id, parsed.data);
  res.json({ account: updated });
});