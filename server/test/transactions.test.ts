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
  return res.body.user;
}

async function createBudget(agent: ReturnType<typeof request.agent>, name: string) {
  const res = await agent.post('/api/budgets').send({ name });
  expect(res.status).toBe(201);
  return res.body.budget;
}

async function setup() {
  const owner = request.agent(app);
  await signup(owner, 'owner@example.com');
  const budget = await createBudget(owner, 'Household');
  const checking = (
    await owner
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Checking', type: 'checking' })
  ).body.account;
  const savings = (
    await owner
      .post(`/api/budgets/${budget.id}/accounts`)
      .send({ name: 'Savings', type: 'savings' })
  ).body.account;
  const group = (
    await owner
      .post(`/api/budgets/${budget.id}/category-groups`)
      .send({ name: 'Everyday' })
  ).body.group;
  const groceries = (
    await owner
      .post(`/api/budgets/${budget.id}/category-groups/${group.id}/categories`)
      .send({ name: 'Groceries' })
  ).body.category;
  return { owner, budget, checking, savings, groceries };
}

/** Narrows the month payload to one category row. */
function categoryRow(
  body: { groups: { categories: { id: string }[] }[] },
  categoryId: string,
) {
  return body.groups.flatMap((g) => g.categories).find((c) => c.id === categoryId);
}

beforeEach(() => resetStore());

describe('creating transactions', () => {
  it('creates an uncategorized transaction when no category or transfer is given', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Farmers market',
        amountMinor: -2500,
        date: '2026-10-05',
      });

    expect(res.status).toBe(201);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({
      accountId: checking.id,
      categoryId: null,
      payee: 'Farmers market',
      amountMinor: -2500,
      date: '2026-10-05',
      cleared: 'uncleared',
      provider: null,
      externalId: null,
      transferTransactionId: null,
    });
  });

  it('creates a categorized transaction', async () => {
    const { owner, budget, checking, groceries } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        categoryId: groceries.id,
        payee: 'Supermarket',
        amountMinor: -8750,
        date: '2026-10-04',
      });

    expect(res.status).toBe(201);
    expect(res.body.transactions[0]).toMatchObject({
      categoryId: groceries.id,
      amountMinor: -8750,
    });
  });

  it('creates a transfer as two linked rows with opposite signs', async () => {
    const { owner, budget, checking, savings } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: savings.id,
        payee: 'ignored for transfers',
        amountMinor: -5000,
        date: '2026-10-07',
      });

    expect(res.status).toBe(201);
    const [out, into] = res.body.transactions;
    expect(out).toMatchObject({
      accountId: checking.id,
      categoryId: null,
      payee: 'Transfer to Savings',
      amountMinor: -5000,
    });
    expect(into).toMatchObject({
      accountId: savings.id,
      categoryId: null,
      payee: 'Transfer from Checking',
      amountMinor: 5000,
    });
    expect(out.transferTransactionId).toBe(into.id);
    expect(into.transferTransactionId).toBe(out.id);
  });

  it('rejects a body that sets both categoryId and transferAccountId', async () => {
    const { owner, budget, checking, savings, groceries } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        categoryId: groceries.id,
        transferAccountId: savings.id,
        payee: 'Confused',
        amountMinor: -1000,
        date: '2026-10-07',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('rejects a transfer to the same account', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: checking.id,
        payee: 'Loop',
        amountMinor: -1000,
        date: '2026-10-07',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a non-integer amount', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Fractional',
        amountMinor: 12.5,
        date: '2026-10-05',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Bad date',
        amountMinor: -100,
        date: '10/05/2026',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown account', async () => {
    const { owner, budget } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: 'acct_missing',
        payee: 'Nowhere',
        amountMinor: -100,
        date: '2026-10-05',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        categoryId: 'catg_missing',
        payee: 'Nowhere',
        amountMinor: -100,
        date: '2026-10-05',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown transfer account', async () => {
    const { owner, budget, checking } = await setup();
    const res = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: 'acct_missing',
        payee: 'Nowhere',
        amountMinor: -100,
        date: '2026-10-05',
      });
    expect(res.status).toBe(400);
  });
});

describe('updating and deleting transactions', () => {
  it('patches a subset of fields', async () => {
    const { owner, budget, checking, groceries } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Draft',
        amountMinor: -100,
        date: '2026-10-05',
      });
    const id = created.body.transactions[0].id;

    const res = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${id}`)
      .send({
        payee: 'Final',
        amountMinor: -900,
        date: '2026-10-06',
        memo: 'note',
        cleared: 'cleared',
        categoryId: groceries.id,
      });
    expect(res.status).toBe(200);
    expect(res.body.transaction).toMatchObject({
      payee: 'Final',
      amountMinor: -900,
      date: '2026-10-06',
      memo: 'note',
      cleared: 'cleared',
      categoryId: groceries.id,
    });
  });

  it('uncategorizes a normal transaction with categoryId null', async () => {
    const { owner, budget, checking, groceries } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        categoryId: groceries.id,
        payee: 'Supermarket',
        amountMinor: -8750,
        date: '2026-10-04',
      });
    const id = created.body.transactions[0].id;

    const res = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${id}`)
      .send({ categoryId: null });
    expect(res.status).toBe(200);
    expect(res.body.transaction.categoryId).toBeNull();
  });

  it('rejects categorizing a transfer side but accepts categoryId null as a no-op', async () => {
    const { owner, budget, checking, savings, groceries } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: savings.id,
        payee: 'Move',
        amountMinor: -5000,
        date: '2026-10-07',
      });
    const out = created.body.transactions[0];

    const rejected = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${out.id}`)
      .send({ categoryId: groceries.id });
    expect(rejected.status).toBe(400);

    const accepted = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${out.id}`)
      .send({ categoryId: null });
    expect(accepted.status).toBe(200);
    expect(accepted.body.transaction.categoryId).toBeNull();
  });

  it('does not modify the linked side when patching a transfer', async () => {
    const { owner, budget, checking, savings } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: savings.id,
        payee: 'Move',
        amountMinor: -5000,
        date: '2026-10-07',
      });
    const [out, into] = created.body.transactions;

    await owner
      .patch(`/api/budgets/${budget.id}/transactions/${out.id}`)
      .send({ payee: 'Renamed side', memo: 'side note' });

    const linked = await owner.get(
      `/api/budgets/${budget.id}/transactions?accountId=${savings.id}`,
    );
    const intoRow = linked.body.transactions.find(
      (t: { id: string }) => t.id === into.id,
    );
    expect(intoRow).toMatchObject({
      payee: 'Transfer from Checking',
      amountMinor: 5000,
      memo: null,
    });
  });

  it('rejects a patch with unknown account or category', async () => {
    const { owner, budget, checking } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Move me',
        amountMinor: -100,
        date: '2026-10-05',
      });
    const id = created.body.transactions[0].id;

    const badAccount = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${id}`)
      .send({ accountId: 'acct_missing' });
    expect(badAccount.status).toBe(400);

    const badCategory = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${id}`)
      .send({ categoryId: 'catg_missing' });
    expect(badCategory.status).toBe(400);
  });

  it('returns 404 when patching an unknown transaction', async () => {
    const { owner, budget } = await setup();
    const res = await owner
      .patch(`/api/budgets/${budget.id}/transactions/txn_missing`)
      .send({ payee: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('deletes both sides of a transfer', async () => {
    const { owner, budget, checking, savings } = await setup();
    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        transferAccountId: savings.id,
        payee: 'Move',
        amountMinor: -5000,
        date: '2026-10-07',
      });
    const out = created.body.transactions[0];

    const del = await owner.delete(
      `/api/budgets/${budget.id}/transactions/${out.id}`,
    );
    expect(del.status).toBe(204);

    const list = await owner.get(`/api/budgets/${budget.id}/transactions`);
    expect(list.body.transactions).toHaveLength(0);
  });

  it('returns 404 when deleting an unknown transaction', async () => {
    const { owner, budget } = await setup();
    const res = await owner.delete(
      `/api/budgets/${budget.id}/transactions/txn_missing`,
    );
    expect(res.status).toBe(404);
  });
});

describe('listing transactions', () => {
  it('filters by account, category, and month with AND', async () => {
    const { owner, budget, checking, savings, groceries } = await setup();
    const create = (body: Record<string, unknown>) =>
      owner.post(`/api/budgets/${budget.id}/transactions`).send(body);

    await create({
      accountId: checking.id,
      categoryId: groceries.id,
      payee: 'Groceries',
      amountMinor: -8750,
      date: '2026-10-04',
    });
    await create({
      accountId: savings.id,
      payee: 'Interest',
      amountMinor: 100,
      date: '2026-10-06',
    });
    await create({
      accountId: checking.id,
      payee: 'Next month',
      amountMinor: -100,
      date: '2026-11-01',
    });

    const byAccount = await owner.get(
      `/api/budgets/${budget.id}/transactions?accountId=${checking.id}`,
    );
    expect(byAccount.body.transactions).toHaveLength(2);

    const byCategory = await owner.get(
      `/api/budgets/${budget.id}/transactions?categoryId=${groceries.id}`,
    );
    expect(byCategory.body.transactions).toHaveLength(1);
    expect(byCategory.body.transactions[0].payee).toBe('Groceries');

    const byMonth = await owner.get(
      `/api/budgets/${budget.id}/transactions?month=2026-10`,
    );
    expect(byMonth.body.transactions).toHaveLength(2);

    const combined = await owner.get(
      `/api/budgets/${budget.id}/transactions?accountId=${checking.id}&month=2026-10`,
    );
    expect(combined.body.transactions).toHaveLength(1);
    expect(combined.body.transactions[0].payee).toBe('Groceries');
  });

  it('rejects a malformed month filter', async () => {
    const { owner, budget } = await setup();
    expect(
      (await owner.get(`/api/budgets/${budget.id}/transactions?month=2026-13`))
        .status,
    ).toBe(400);
    expect(
      (await owner.get(`/api/budgets/${budget.id}/transactions?month=oct`))
        .status,
    ).toBe(400);
  });
});

describe('transaction permissions', () => {
  it('lets members read but blocks viewers from writing', async () => {
    const { owner, budget, checking } = await setup();
    const viewer = request.agent(app);
    await signup(viewer, 'viewer@example.com');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    const created = await owner
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Owner row',
        amountMinor: -100,
        date: '2026-10-05',
      });

    expect(
      (await viewer.get(`/api/budgets/${budget.id}/transactions`)).status,
    ).toBe(200);

    const write = await viewer
      .post(`/api/budgets/${budget.id}/transactions`)
      .send({
        accountId: checking.id,
        payee: 'Viewer row',
        amountMinor: -100,
        date: '2026-10-05',
      });
    expect(write.status).toBe(403);

    const patch = await viewer
      .patch(
        `/api/budgets/${budget.id}/transactions/${created.body.transactions[0].id}`,
      )
      .send({ payee: 'Nope' });
    expect(patch.status).toBe(403);

    const del = await viewer.delete(
      `/api/budgets/${budget.id}/transactions/${created.body.transactions[0].id}`,
    );
    expect(del.status).toBe(403);
  });

  it('hides transactions from non-members', async () => {
    const { budget } = await setup();
    const stranger = request.agent(app);
    await signup(stranger, 'stranger@example.com');

    expect(
      (await stranger.get(`/api/budgets/${budget.id}/transactions`)).status,
    ).toBe(404);
    expect(
      (
        await stranger.post(`/api/budgets/${budget.id}/transactions`).send({
          accountId: 'acct_missing',
          payee: 'Nowhere',
          amountMinor: -100,
          date: '2026-10-05',
        })
      ).status,
    ).toBe(404);
  });
});

describe('month integration', () => {
  it('counts uncategorized income toward ready to assign', async () => {
    const { owner, budget, checking } = await setup();
    await owner.post(`/api/budgets/${budget.id}/transactions`).send({
      accountId: checking.id,
      payee: 'Payroll',
      amountMinor: 120000,
      date: '2026-10-02',
    });

    const res = await owner.get(`/api/budgets/${budget.id}/months/2026-10`);
    expect(res.status).toBe(200);
    expect(res.body.readyToAssignMinor).toBe(120000);
  });

  it('lowers category available and records activity for categorized spend', async () => {
    const { owner, budget, checking, groceries } = await setup();
    await owner
      .put(`/api/budgets/${budget.id}/months/2026-10`)
      .send({ allocations: [{ categoryId: groceries.id, allocatedMinor: 20000 }] });
    await owner.post(`/api/budgets/${budget.id}/transactions`).send({
      accountId: checking.id,
      categoryId: groceries.id,
      payee: 'Supermarket',
      amountMinor: -5000,
      date: '2026-10-04',
    });

    const res = await owner.get(`/api/budgets/${budget.id}/months/2026-10`);
    expect(categoryRow(res.body, groceries.id)).toMatchObject({
      allocatedMinor: 20000,
      activityMinor: -5000,
      availableMinor: 15000,
    });
    expect(res.body.readyToAssignMinor).toBe(-20000);
  });

  it('does not count a transfer inflow as income', async () => {
    const { owner, budget, checking, savings } = await setup();
    await owner.post(`/api/budgets/${budget.id}/transactions`).send({
      accountId: checking.id,
      transferAccountId: savings.id,
      payee: 'Move',
      amountMinor: -5000,
      date: '2026-10-07',
    });

    const savingsRows = await owner.get(
      `/api/budgets/${budget.id}/transactions?accountId=${savings.id}`,
    );
    expect(savingsRows.body.transactions[0].amountMinor).toBe(5000);

    const res = await owner.get(`/api/budgets/${budget.id}/months/2026-10`);
    expect(res.body.readyToAssignMinor).toBe(0);
  });

  it('carries overspending into the next month', async () => {
    const { owner, budget, checking, groceries } = await setup();
    await owner.post(`/api/budgets/${budget.id}/transactions`).send({
      accountId: checking.id,
      categoryId: groceries.id,
      payee: 'Supermarket',
      amountMinor: -5000,
      date: '2026-10-04',
    });

    const october = await owner.get(`/api/budgets/${budget.id}/months/2026-10`);
    expect(october.body.readyToAssignMinor).toBe(0);

    const november = await owner.get(`/api/budgets/${budget.id}/months/2026-11`);
    expect(november.body.readyToAssignMinor).toBe(-5000);
  });
});

describe('frozen transfer money fields', () => {
  async function createTransfer(
    owner: ReturnType<typeof request.agent>,
    budgetId: string,
    accountId: string,
    transferAccountId: string,
  ) {
    const res = await owner
      .post(`/api/budgets/${budgetId}/transactions`)
      .send({
        accountId,
        transferAccountId,
        payee: 'Move',
        amountMinor: -5000,
        date: '2026-10-07',
      });
    expect(res.status).toBe(201);
    return res.body.transactions as { id: string; amountMinor: number }[];
  }

  async function rowsById(
    owner: ReturnType<typeof request.agent>,
    budgetId: string,
  ) {
    const res = await owner.get(`/api/budgets/${budgetId}/transactions`);
    return res.body.transactions as {
      id: string;
      amountMinor: number;
      payee: string;
      memo: string | null;
      cleared: string;
      categoryId: string | null;
    }[];
  }

  it('rejects amountMinor, date, accountId, and a non-null categoryId on a transfer side', async () => {
    const { owner, budget, checking, savings, groceries } = await setup();
    const [out, into] = await createTransfer(
      owner,
      budget.id,
      checking.id,
      savings.id,
    );
    const url = `/api/budgets/${budget.id}/transactions/${out.id}`;

    for (const body of [
      { amountMinor: -6000 },
      { date: '2026-10-08' },
      { accountId: savings.id },
      { categoryId: groceries.id },
    ]) {
      const res = await owner.patch(url).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    }

    const rows = await rowsById(owner, budget.id);
    const outRow = rows.find((r) => r.id === out.id)!;
    const intoRow = rows.find((r) => r.id === into.id)!;
    expect(outRow.amountMinor).toBe(-5000);
    expect(intoRow.amountMinor).toBe(5000);
    expect(outRow.amountMinor + intoRow.amountMinor).toBe(0);
  });

  it('allows payee, memo, and cleared on a transfer side without moving money', async () => {
    const { owner, budget, checking, savings } = await setup();
    const [out, into] = await createTransfer(
      owner,
      budget.id,
      checking.id,
      savings.id,
    );

    const res = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${out.id}`)
      .send({ payee: 'Corrected', memo: 'note', cleared: 'cleared' });
    expect(res.status).toBe(200);
    expect(res.body.transaction).toMatchObject({
      id: out.id,
      payee: 'Corrected',
      memo: 'note',
      cleared: 'cleared',
      amountMinor: -5000,
    });

    const rows = await rowsById(owner, budget.id);
    const outRow = rows.find((r) => r.id === out.id)!;
    const intoRow = rows.find((r) => r.id === into.id)!;
    expect(intoRow).toMatchObject({
      payee: 'Transfer from Checking',
      amountMinor: 5000,
      memo: null,
      cleared: 'uncleared',
    });
    expect(outRow.amountMinor + intoRow.amountMinor).toBe(0);
  });

  it('accepts categoryId null on a transfer side as a no-op', async () => {
    const { owner, budget, checking, savings } = await setup();
    const [out, into] = await createTransfer(
      owner,
      budget.id,
      checking.id,
      savings.id,
    );

    const res = await owner
      .patch(`/api/budgets/${budget.id}/transactions/${out.id}`)
      .send({ categoryId: null });
    expect(res.status).toBe(200);
    expect(res.body.transaction).toMatchObject({
      categoryId: null,
      amountMinor: -5000,
    });

    const rows = await rowsById(owner, budget.id);
    const outRow = rows.find((r) => r.id === out.id)!;
    const intoRow = rows.find((r) => r.id === into.id)!;
    expect(outRow.amountMinor).toBe(-5000);
    expect(intoRow.amountMinor).toBe(5000);
    expect(outRow.categoryId).toBeNull();
    expect(intoRow.categoryId).toBeNull();
  });
});
