import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../errors';
import { loadBudget, requireBudgetRole } from '../middleware/auth';
import {
  createCategory,
  createCategoryGroup,
  deleteCategory,
  deleteCategoryGroup,
  getCategory,
  getCategoryGroup,
  listCategories,
  listCategoryGroups,
  updateCategory,
  updateCategoryGroup,
} from '../store';

const nameSchema = z.string().trim().min(1).max(60);
const groupPatchSchema = z.object({ name: nameSchema });
const categoryPatchSchema = z
  .object({
    name: nameSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.archived !== undefined, {
    message: 'Provide name or archived',
  });

export const categoryGroupsRouter = Router({ mergeParams: true });
export const categoriesRouter = Router({ mergeParams: true });

categoryGroupsRouter.get('/', loadBudget, (req, res) => {
  const groups = listCategoryGroups(req.params.budgetId).map((group) => ({
    ...group,
    categories: listCategories(req.params.budgetId, group.id),
  }));
  res.json({ groups });
});

categoryGroupsRouter.post('/', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const parsed = nameSchema.safeParse(req.body?.name);
  if (!parsed.success) {
    return next(badRequest('Invalid group name', parsed.error.flatten()));
  }
  const group = createCategoryGroup(req.params.budgetId, parsed.data);
  res.status(201).json({ group: { ...group, categories: [] } });
});

categoryGroupsRouter.patch('/:groupId', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const parsed = groupPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid group name', parsed.error.flatten()));
  }
  if (!getCategoryGroup(req.params.budgetId, req.params.groupId)) {
    return next(notFound('Category group not found'));
  }
  const group = updateCategoryGroup(req.params.budgetId, req.params.groupId, parsed.data.name);
  res.json({ group: { ...group, categories: listCategories(req.params.budgetId, group.id) } });
});

categoryGroupsRouter.delete('/:groupId', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  if (!getCategoryGroup(req.params.budgetId, req.params.groupId)) {
    return next(notFound('Category group not found'));
  }
  deleteCategoryGroup(req.params.budgetId, req.params.groupId);
  res.status(204).end();
});

categoryGroupsRouter.post('/:groupId/categories', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  if (!getCategoryGroup(req.params.budgetId, req.params.groupId)) {
    return next(notFound('Category group not found'));
  }
  const parsed = nameSchema.safeParse(req.body?.name);
  if (!parsed.success) {
    return next(badRequest('Invalid category name', parsed.error.flatten()));
  }
  const category = createCategory(req.params.budgetId, req.params.groupId, parsed.data);
  res.status(201).json({ category });
});

categoriesRouter.patch('/:categoryId', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  const parsed = categoryPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(badRequest('Invalid category details', parsed.error.flatten()));
  }
  if (!getCategory(req.params.budgetId, req.params.categoryId)) {
    return next(notFound('Category not found'));
  }
  const category = updateCategory(req.params.budgetId, req.params.categoryId, parsed.data);
  res.json({ category });
});

categoriesRouter.delete('/:categoryId', loadBudget, requireBudgetRole('editor'), (req, res, next) => {
  if (!getCategory(req.params.budgetId, req.params.categoryId)) {
    return next(notFound('Category not found'));
  }
  deleteCategory(req.params.budgetId, req.params.categoryId);
  res.status(204).end();
});