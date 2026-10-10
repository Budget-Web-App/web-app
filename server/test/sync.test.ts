import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAccount, resetStore } from '../src/store';

const app = createApp();

interface AccountRow {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  externalId: string | null;
  balanceMinor: number;
}

async function signup(agent: ReturnType<typeof request.agent>, email: string) {
  const res = await agent.post('/api/auth/signup').send({
    email,
    password: 'supersecret',
    name: email.split('@')[0],
  });
  expect(res.status).toBe(201);
  return res.body.user;
}

async function createBudget(agent: ReturnType<typeof request.agent>, name: string) {
  const res = await agent.post('/api/budgets').send({ name });
  expect(res.status).toBe(201);
  return res.body.budget;
}

async function listAccounts(agent: ReturnType<typeof request.agent>, budgetId: string) {
  const res = await agent.get(`/api/budgets/${budgetId}/accounts`);
  expect(res.status).toBe(200);
  return res.body.accounts as AccountRow[];
}

function byExternalId(accounts: AccountRow[], externalId: string) {
  const account = accounts.find((a) => a.externalId === externalId);
  expect(account, `account ${externalId}`).toBeDefined();
  return account as AccountRow;
}

beforeEach(() => resetStore());

describe('sync providers', () => {
  it('lists providers for any member and rejects unauthenticated callers', async () => {
    const owner = request.agent(app);
    const viewer = request.agent(app);
    await signup(owner, 'owner@example.com');
    await signup(viewer, 'viewer@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    const unauth = await request.agent(app).get(
      `/api/budgets/${budget.id}/sync/providers`,
    );
    expect(unauth.status).toBe(401);

    const asOwner = await owner.get(`/api/budgets/${budget.id}/sync/providers`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.providers).toContainEqual({ id: 'mock', name: 'Mock Bank' });

    const asViewer = await viewer.get(`/api/budgets/${budget.id}/sync/providers`);
    expect(asViewer.status).toBe(200);
  });

  it('hides providers from non-members', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    const stranger = request.agent(app);
    await signup(stranger, 'stranger@example.com');

    const res = await stranger.get(`/api/budgets/${budget.id}/sync/providers`);
    expect(res.status).toBe(404);
  });
});

describe('sync import and dedupe', () => {
  it('imports both mock accounts and dedupes a second run', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const first = await owner
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ imported: 9, ignored: 0, matched: 0 });

    const accounts = await listAccounts(owner, budget.id);
    expect(accounts).toHaveLength(2);
    expect(byExternalId(accounts, 'mock_checking')).toMatchObject({
      name: 'Mock Checking',
      type: 'checking',
      provider: 'mock',
      balanceMinor: 272705,
    });
    expect(byExternalId(accounts, 'mock_credit')).toMatchObject({
      name: 'Mock Credit Card',
      type: 'credit',
      provider: 'mock',
      balanceMinor: -10450,
    });

    const afterFirst = await owner.get(`/api/budgets/${budget.id}/transactions`);
    expect(afterFirst.body.transactions).toHaveLength(9);

    const second = await owner
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({});
    expect(second.body).toEqual({ imported: 0, ignored: 9, matched: 0 });

    const afterSecond = await owner.get(`/api/budgets/${budget.id}/transactions`);
    expect(afterSecond.body.transactions).toHaveLength(9);
  });

  it('imports only the requested external account', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const res = await owner
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({ accountExternalId: 'mock_checking' });
    expect(res.body).toEqual({ imported: 6, ignored: 0, matched: 0 });

    const accounts = await listAccounts(owner, budget.id);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      externalId: 'mock_checking',
      balanceMinor: 272705,
    });
  });

  it('includes transfers in derived account balances', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner.post(`/api/budgets/${budget.id}/sync/mock`).send({});

    const before = await listAccounts(owner, budget.id);
    const checking = byExternalId(before, 'mock_checking');
    const credit = byExternalId(before, 'mock_credit');

    const transfer = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: credit.id,
        payee: 'Pay down card',
        amountMinor: -5000,
        date: '2026-10-10',
      });
    expect(transfer.status).toBe(201);

    const after = await listAccounts(owner, budget.id);
    expect(byExternalId(after, 'mock_checking').balanceMinor).toBe(267705);
    expect(byExternalId(after, 'mock_credit').balanceMinor).toBe(-5450);
  });

  it('adopts a hand-entered transaction instead of duplicating it', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    // The importer links provider accounts by (provider, externalId). There is
    // no HTTP route that sets those fields, so seed the linked account directly
    // to reproduce the "hand-entered row already on the target account" case.
    const checking = createAccount({
      budgetId: budget.id,
      name: 'Mock Checking',
      type: 'checking',
      provider: 'mock',
      externalId: 'mock_checking',
    });
    const handEntered = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'River City Coffee',
        amountMinor: -465,
        date: '2026-10-03',
      });
    expect(handEntered.status).toBe(201);

    const first = await owner
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({});
    expect(first.body).toEqual({ imported: 8, ignored: 0, matched: 1 });

    const accounts = await listAccounts(owner, budget.id);
    expect(accounts).toHaveLength(2);

    const rows = await owner.get(`/api/budgets/${budget.id}/transactions`);
    const matches = rows.body.transactions.filter(
      (t: { payee: string; date: string }) =>
        t.payee === 'River City Coffee' && t.date === '2026-10-03',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      accountId: checking.id,
      provider: 'mock',
      externalId: 'chk-2026-10-03',
      categoryId: null,
      amountMinor: -465,
    });

    const second = await owner
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({});
    expect(second.body).toEqual({ imported: 0, ignored: 9, matched: 0 });
    expect(
      (await owner.get(`/api/budgets/${budget.id}/transactions`)).body.transactions,
    ).toHaveLength(9);
  });

  it('blocks viewers and rejects an unknown provider', async () => {
    const owner = request.agent(app);
    const viewer = request.agent(app);
    await signup(owner, 'owner@example.com');
    await signup(viewer, 'viewer@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    const asViewer = await viewer
      .post(`/api/budgets/${budget.id}/sync/mock`)
      .send({});
    expect(asViewer.status).toBe(403);

    const unknown = await owner
      .post(`/api/budgets/${budget.id}/sync/does-not-exist`)
      .send({});
    expect(unknown.status).toBe(404);
  });
});
