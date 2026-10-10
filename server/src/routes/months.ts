import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import { computeMonth } from '../month';
import { getCategory, setAllocation } from '../store';

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const allocationSchema = z.object({
  categoryId: z.string().min(1),
  allocatedMinor: z.number().int().min(0),
});

const putSchema = z.object({
  allocations: z.array(allocationSchema).max(500),
});

export const monthsRouter = Router({ mergeParams: true });

monthsRouter.get('/:month', loadBudget, (req, res, next) => {
  const month = monthSchema.safeParse(req.params.month);
  if (!month.success) return next(badRequest('Month must be YYYY-MM'));
  res.json(computeMonth(req.params.budgetId, month.data));
});

monthsRouter.put('/:month', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const month = monthSchema.safeParse(req.params.month);
  if (!month.success) return next(badRequest('Month must be YYYY-MM'));
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid allocations', parsed.error.flatten()));
  }
  for (const allocation of parsed.data.allocations) {
    if (!getCategory(req.params.budgetId, allocation.categoryId)) {
      return next(
        badRequest('Category does not belong to this budget', {
          categoryId: allocation.categoryId,
        }),
      );
    }
  }
  for (const allocation of parsed.data.allocations) {
    setAllocation(allocation.categoryId, month.data, allocation.allocatedMinor);
  }
  res.json(computeMonth(req.params.budgetId, month.data));
});