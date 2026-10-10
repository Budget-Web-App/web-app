import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import { getProvider, listProviders } from '../sync';
import {
  createAccount,
  createTransaction,
  findDuplicateTransaction,
  findTransactionByExternalId,
  listAccounts,
} from '../store';

/** Express 4 does not catch rejected promises; route async errors through next. */
const asyncHandler =
  (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const syncSchema = z.object({
  credentials: z.unknown().optional(),
  accountExternalId: z.string().min(1).optional(),
});

export const syncRouter = Router({ mergeParams: true });

syncRouter.get('/providers', loadBudget, (_req, res) => {
  res.json({
    providers: listProviders().map((p) => ({ id: p.id, name: p.name })),
  });
});

syncRouter.post(
  '/:provider',
  loadBudget,
  requireBudgetRole('editor'),
  asyncHandler(async (req, res, next) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('Invalid sync details', parsed.error.flatten()));
    }
    const provider = getProvider(req.params.provider);
    if (!provider) return next(notFound('Sync provider not found'));

    const budgetId = req.params.budgetId;

    const externalAccounts = await provider.listAccounts(parsed.data.credentials);
    const targets = parsed.data.accountExternalId
      ? externalAccounts.filter(
          (a) => a.externalId === parsed.data.accountExternalId,
        )
      : externalAccounts;

    let imported = 0;
    let ignored = 0;
    let matched = 0;

    for (const external of targets) {
      let account = listAccounts(budgetId).find(
        (a) => a.provider === provider.id && a.externalId === external.externalId,
      );
      if (!account) {
        account = createAccount({
          budgetId,
          name: external.name,
          type: external.type,
          provider: provider.id,
          externalId: external.externalId,
        });
      }
      const feed = await provider.listTransactions(external.externalId);
      for (const item of feed) {
        if (findTransactionByExternalId(budgetId, provider.id, item.externalId)) {
          ignored += 1;
          continue;
        }
        const duplicate = findDuplicateTransaction(budgetId, {
          accountId: account.id,
          date: item.postedAt,
          amountMinor: item.amountMinor,
          payee: item.payee,
        });
        if (duplicate) {
          duplicate.provider = provider.id;
          duplicate.externalId = item.externalId;
          matched += 1;
          continue;
        }
        createTransaction({
          budgetId,
          accountId: account.id,
          categoryId: null,
          payee: item.payee,
          amountMinor: item.amountMinor,
          date: item.postedAt,
          cleared: item.cleared ? 'cleared' : 'uncleared',
          provider: provider.id,
          externalId: item.externalId,
        });
        imported += 1;
      }
    }

    res.json({ imported, ignored, matched });
  }),
);
