import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import {
  createTransaction,
  deleteTransactions,
  getAccount,
  getCategory,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '../store';

const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const createSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  transferAccountId: z.string().min(1).optional(),
  payee: z.string().trim().min(1).max(80),
  amountMinor: z.number().int(),
  date: dateSchema,
  memo: z.string().trim().max(500).optional(),
});

const patchSchema = z
  .object({
    payee: z.string().trim().min(1).max(80).optional(),
    amountMinor: z.number().int().optional(),
    date: dateSchema.optional(),
    memo: z.string().trim().max(500).nullable().optional(),
    cleared: z.enum(['cleared', 'uncleared']).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    accountId: z.string().min(1).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Provide at least one field',
  });

export const transactionsRouter = Router({ mergeParams: true });

transactionsRouter.get('/', loadBudget, (req, res, next) => {
  const { accountId, categoryId, month } = req.query;
  const filters: { accountId?: string; categoryId?: string; month?: string } = {};
  if (typeof accountId === 'string') filters.accountId = accountId;
  if (typeof categoryId === 'string') filters.categoryId = categoryId;
  if (month !== undefined) {
    if (typeof month !== 'string' || !monthSchema.safeParse(month).success) {
      return next(badRequest('Month must be YYYY-MM'));
    }
    filters.month = month;
  }
  res.json({ transactions: listTransactions(req.params.budgetId, filters) });
});

transactionsRouter.post(
  '/',
  loadBudget,
  requireBudgetRole('editor'),
  (req, res, next) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid transaction details', parsed.error.flatten()));
    }
    const budgetId = req.params.budgetId;
    const body = parsed.data;
    const source = getAccount(budgetId, body.accountId);
    if (!source) {
      return next(
        badRequest('Account does not belong to this budget', {
          accountId: body.accountId,
        }),
      );
    }
    if (body.categoryId !== undefined && body.transferAccountId !== undefined) {
      return next(badRequest('Provide exactly one of categoryId or transferAccountId'));
    }
    if (body.transferAccountId !== undefined) {
      const target = getAccount(budgetId, body.transferAccountId);
      if (!target) {
        return next(
          badRequest('Transfer account does not belong to this budget', {
            transferAccountId: body.transferAccountId,
          }),
        );
      }
      if (target.id === source.id) {
        return next(
          badRequest('Transfer account must be different from the source account'),
        );
      }
      const out = createTransaction({
        budgetId,
        accountId: source.id,
        categoryId: null,
        payee: `Transfer to ${target.name}`,
        amountMinor: body.amountMinor,
        date: body.date,
        memo: body.memo ?? null,
      });
      const into = createTransaction({
        budgetId,
        accountId: target.id,
        categoryId: null,
        payee: `Transfer from ${source.name}`,
        amountMinor: -body.amountMinor,
        date: body.date,
        memo: body.memo ?? null,
      });
      out.transferTransactionId = into.id;
      into.transferTransactionId = out.id;
      return res.status(201).json({ transactions: [out, into] });
    }
    const categoryId = body.categoryId;
    if (categoryId !== undefined && !getCategory(budgetId, categoryId)) {
      return next(
        badRequest('Category does not belong to this budget', { categoryId }),
      );
    }
    const transaction = createTransaction({
      budgetId,
      accountId: source.id,
      categoryId: categoryId ?? null,
      payee: body.payee,
      amountMinor: body.amountMinor,
      date: body.date,
      memo: body.memo ?? null,
    });
    res.status(201).json({ transactions: [transaction] });
  },
);

transactionsRouter.patch(
  '/:transactionId',
  loadBudget,
  requireBudgetRole('editor'),
  (req, res, next) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid transaction details', parsed.error.flatten()));
    }
    const budgetId = req.params.budgetId;
    const transaction = getTransaction(budgetId, req.params.transactionId);
    if (!transaction) return next(notFound('Transaction not found'));

    const patch = parsed.data;
    // Transfer money fields are frozen: editing one side alone breaks the pair's net-zero balance.
    if (
      transaction.transferTransactionId &&
      (patch.amountMinor !== undefined ||
        patch.date !== undefined ||
        patch.accountId !== undefined ||
        (patch.categoryId !== undefined && patch.categoryId !== null))
    ) {
      return next(
        badRequest('Transfer amounts, dates, and accounts cannot be changed'),
      );
    }
    if (patch.categoryId !== undefined && patch.categoryId !== null) {
      if (!getCategory(budgetId, patch.categoryId)) {
        return next(
          badRequest('Category does not belong to this budget', {
            categoryId: patch.categoryId,
          }),
        );
      }
    }
    if (patch.accountId !== undefined && !getAccount(budgetId, patch.accountId)) {
      return next(
        badRequest('Account does not belong to this budget', {
          accountId: patch.accountId,
        }),
      );
    }
    res.json({ transaction: updateTransaction(budgetId, transaction.id, patch) });
  },
);

transactionsRouter.delete(
  '/:transactionId',
  loadBudget,
  requireBudgetRole('editor'),
  (req, res, next) => {
    const budgetId = req.params.budgetId;
    const transaction = getTransaction(budgetId, req.params.transactionId);
    if (!transaction) return next(notFound('Transaction not found'));
    const ids = transaction.transferTransactionId
      ? [transaction.id, transaction.transferTransactionId]
      : [transaction.id];
    deleteTransactions(budgetId, ids);
    res.status(204).end();
  },
);
