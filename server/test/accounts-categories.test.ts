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

async function createBudget(agent: ReturnType<typeof request.agent>, name: string) {
  const res = await agent.post('/api/budgets').send({ name });
  expect(res.status).toBe(201);
  return res.body.budget;
}

beforeEach(() => resetStore());

describe('accounts', () => {
  it('creates, lists, and closes accounts', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const checking = await owner
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Checking', type: 'checking' });
    expect(checking.status).toBe(201);
    expect(checking.body.account).toMatchObject({
      name: 'Checking',
      type: 'checking',
      closed: false,
      budgetId: budget.id,
    });

    await owner
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Credit card', type: 'credit' });

    const list = await owner.get(`/api/budgets/${budget.id}/accounts`);
    expect(list.body.accounts).toHaveLength(2);

    const close = await owner
      .patch(`/api/budgets/${budget.id}/accounts/${checking.body.account.id}`)
      .send({ closed: true });
    expect(close.status).toBe(200);
    expect(close.body.account.closed).toBe(true);
  });

  it('rejects an account outside the budget', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const first = await createBudget(owner, 'Household');
    const second = await createBudget(owner, 'Business');
    const account = await owner
      .post(`/api/budgets/${first.id}/accounts`)
      .send({ name: 'Checking', type: 'checking' });

    const res = await owner
      .patch(`/api/budgets/${second.id}/accounts/${account.body.account.id}`)
      .send({ closed: true });
    expect(res.status).toBe(404);
  });

  it('rejects a bad account payload', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const bad = await owner
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Checking', type: 'crypto' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_error');

    const empty = await owner
      .patch(`/api/budgets/${budget.id}/accounts/nope`)
      .send({});
    expect(empty.status).toBe(400);
  });

  it('blocks writes for viewers', async () => {
    const owner = request.agent(app);
    const viewer = request.agent(app);
    await signup(owner, 'owner@example.com');
    await signup(viewer, 'viewer@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    const create = await viewer
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Nope', type: 'checking' });
    expect(create.status).toBe(403);

    const list = await viewer.get(`/api/budgets/${budget.id}/accounts`);
    expect(list.status).toBe(200);
  });
});

describe('category groups and categories', () => {
  it('creates groups with nested categories', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const group = await owner
      .post(`/api/budgets/${budget.id}/category-groups`)
      .send({ name: 'Fixed costs' });
    expect(group.status).toBe(201);
    expect(group.body.group.name).toBe('Fixed costs');

    const rent = await owner
      .post(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}/categories`)
      .send({ name: 'Rent' });
    expect(rent.status).toBe(201);

    const list = await owner.get(`/api/budgets/${budget.id}/category-groups`);
    expect(list.body.groups).toHaveLength(1);
    expect(list.body.groups[0].categories).toHaveLength(1);
    expect(list.body.groups[0].categories[0].name).toBe('Rent');
  });

  it('archives a category out of activity but keeps it in the group', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    const group = await owner
      .post(`/api/budgets/${budget.id}/category-groups`)
      .send({ name: 'Bills' });
    const category = await owner
      .post(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}/categories`)
      .send({ name: 'Phone' });

    const archive = await owner
      .patch(`/api/budgets/${budget.id}/categories/${category.body.category.id}`)
      .send({ archived: true });
    expect(archive.status).toBe(200);
    expect(archive.body.category.archived).toBe(true);

    const groups = await owner.get(`/api/budgets/${budget.id}/category-groups`);
    expect(groups.body.groups[0].categories[0].archived).toBe(true);

    const month = await owner.get(`/api/budgets/${budget.id}/months/2026-10`);
    const categoriesInMonth = month.body.groups.flatMap((g: { categories: unknown[] }) => g.categories);
    expect(categoriesInMonth).toHaveLength(0);
  });

  it('deletes a group and its categories in one call', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    const group = await owner
      .post(`/api/budgets/${budget.id}/category-groups`)
      .send({ name: 'Bills' });
    await owner
      .post(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}/categories`)
      .send({ name: 'Phone' });

    const del = await owner.delete(`/api/budgets/${budget.id}/category-groups/${group.body.group.id}`);
    expect(del.status).toBe(204);
    const groups = await owner.get(`/api/budgets/${budget.id}/category-groups`);
    expect(groups.body.groups).toHaveLength(0);
  });
});