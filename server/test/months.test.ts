import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetStore } from '../src/store';

const app = createApp();

async function signup(agent: ReturnType<typeof request.agent>, email: string) {
  const res = await agent.post('/api/auth/signup').send({
    email,
    password: 'supersecret',
    name: email.split('@')[0],
  });
  expect(res.status).toBe(201);
}

async function setupWithCategories() {
  const owner = request.agent(app);
  await signup(owner, 'owner@example.com');
  const budgetRes = await owner.post('/api/budgets').send({ name: 'Household' });
  const budget = budgetRes.body.budget;
  const group = await owner
    .post(`/api/budgets/${budget.id}/category-groups`)
    .send({ name: 'Fixed costs' });
  const rent = await owner
    .post(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}/categories`)
    .send({ name: 'Rent' });
  const food = await owner
    .post(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}/categories`)
    .send({ name: 'Food' });
  return { owner, budget, group: group.body.group, rent: rent.body.category, food: food.body.category };
}

beforeEach(() => resetStore());

describe('months and allocation', () => {
  it('reports an empty month', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budgetRes = await owner.post('/api/budgets').send({ name: 'Household' });
    const res = await owner.get(`/api/budgets/${budgetRes.body.budget.id}/months/2026-10`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ month: '2026-10', readyToAssignMinor: 0, groups: [] });
  });

  it('assigns money and reports allocated and available balances', async () => {
    const { owner, budget, rent, food } = await setupWithCategories();
    const res = await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({
        allocations: [
          { categoryId: rent.id, allocatedMinor: 120000 },
          { categoryId: food.id, allocatedMinor: 45000 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.readyToAssignMinor).toBe(-165000);

    const groups = res.body.groups as { categories: { id: string; allocatedMinor: number; activityMinor: number; availableMinor: number }[] }[];
    const byId = new Map(
      groups.flatMap((g) => g.categories).map((c) => [c.id, c]),
    );
    expect(byId.get(rent.id)).toMatchObject({
      allocatedMinor: 120000,
      activityMinor: 0,
      availableMinor: 120000,
    });
    expect(byId.get(food.id)).toMatchObject({
      allocatedMinor: 45000,
      availableMinor: 45000,
    });
  });

  it('carries available forward month to month', async () => {
    const { owner, budget, rent } = await setupWithCategories();
    await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [{ categoryId: rent.id, allocatedMinor: 120000 }] });
    await owner
      .put(`/api/budgets/${budget.id}/months/2026-11`)
      .send({ allocations: [{ categoryId: rent.id, allocatedMinor: 120000 }] });

    const november = await owner.get(`/api/budgets/${budget.id}/months/2026-11`);
    const rentRow = november.body.groups.flatMap((g: { categories: { id: string }[] }) => g.categories).find((c: { id: string }) => c.id === rent.id);
    expect(rentRow.availableMinor).toBe(240000);
  });

  it('rejects a malformed month', async () => {
    const { owner, budget } = await setupWithCategories();
    const bad = await owner.get(`/api/budgets/${budget.id}/months/2026-13`);
    expect(bad.status).toBe(400);
    const notIntent = await owner.get(`/api/budgets/${budget.id}/months/oct`);
    expect(notIntent.status).toBe(400);
  });

  it('rejects an allocation for a category outside the budget', async () => {
    const { owner, budget } = await setupWithCategories();
    const other = request.agent(app);
    await signup(other, 'other@example.com');
    const otherBudget = await other.post('/api/budgets').send({ name: 'Other' });
    const otherGroup = await other
      .post(`/api/budgets/${otherBudget.body.budget.id}/category-groups`)
      .send({ name: 'Group' });
    const foreignCategory = await other
      .post(`/api/budgets/${otherBudget.body.budget.id}/category-groups/${otherGroup.body.group.id}/categories`)
      .send({ name: 'Foreign' });

    const res = await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [{ categoryId: foreignCategory.body.category.id, allocatedMinor: 100 }] });
    expect(res.status).toBe(400);
  });

  it('rejects a negative or fractional allocation', async () => {
    const { owner, budget, rent } = await setupWithCategories();
    const negative = await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [{ categoryId: rent.id, allocatedMinor: -500 }] });
    expect(negative.status).toBe(400);

    const fractional = await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [{ categoryId: rent.id, allocatedMinor: 12.5 }] });
    expect(fractional.status).toBe(400);
  });

  it('lets members read months but only editors write allocations', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const viewer = request.agent(app);
    await signup(viewer, 'viewer@example.com');
    const budgetRes = await owner.post('/api/budgets').send({ name: 'Household' });
    const budget = budgetRes.body.budget;
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    expect((await viewer.get(`/api/budgets/${budget.id}/months/2026-10`)).status).toBe(200);
    const write = await viewer
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [] });
    expect(write.status).toBe(403);
  });
});