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

beforeEach(() => resetStore());

describe('budgets and memberships', () => {
  it('creates a budget with the creator as owner', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    expect(budget).toMatchObject({ name: 'Household', currency: 'USD', role: 'owner' });

    const list = await owner.get('/api/budgets');
    expect(list.status).toBe(200);
    expect(list.body.budgets).toHaveLength(1);
    expect(list.body.budgets[0].role).toBe('owner');
  });

  it('hides a budget from non-members', async () => {
    const owner = request.agent(app);
    const stranger = request.agent(app);
    await signup(owner, 'owner@example.com');
    await signup(stranger, 'stranger@example.com');
    const budget = await createBudget(owner, 'Secret');
    const res = await stranger.get(`/api/budgets/${budget.id}`);
    expect(res.status).toBe(404);
    expect((await stranger.get('/api/budgets')).body.budgets).toHaveLength(0);
  });

  it('adds a viewer and lets the owner change roles', async () => {
    const owner = request.agent(app);
    const viewer = request.agent(app);
    await signup(owner, 'owner@example.com');
    const viewerUser = await signup(viewer, 'viewer@example.com');
    const budget = await createBudget(owner, 'Household');

    const add = await owner.post(`/api/budgets/${budget.id}/members`).send({
      email: viewerUser.email,
      role: 'viewer',
    });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe('viewer');

    const members = await owner.get(`/api/budgets/${budget.id}/members`);
    expect(members.body.members).toHaveLength(2);

    // Viewer can read the budget but cannot change it.
    expect((await viewer.get(`/api/budgets/${budget.id}`)).status).toBe(200);
    expect(
      (await viewer.patch(`/api/budgets/${budget.id}`).send({ name: 'Nope' }))
        .status,
    ).toBe(403);

    // Owner promotes to editor; the editor can now rename.
    const promote = await owner
      .patch(`/api/budgets/${budget.id}/members/${viewerUser.id}`)
      .send({ role: 'editor' });
    expect(promote.status).toBe(200);
    expect(promote.body.member.role).toBe('editor');
    const rename = await viewer
      .patch(`/api/budgets/${budget.id}`)
      .send({ name: 'Family' });
    expect(rename.status).toBe(200);
    expect(rename.body.budget.name).toBe('Family');
  });

  it('lets an owner remove a member', async () => {
    const owner = request.agent(app);
    const viewer = request.agent(app);
    await signup(owner, 'owner@example.com');
    const viewerUser = await signup(viewer, 'viewer@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: viewerUser.email, role: 'viewer' });

    const remove = await owner.delete(`/api/budgets/${budget.id}/members/${viewerUser.id}`);
    expect(remove.status).toBe(204);
    expect((await viewer.get(`/api/budgets/${budget.id}`)).status).toBe(404);
  });

  it('refuses to leave a budget without an owner', async () => {
    const owner = request.agent(app);
    const alice = await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');

    const demote = await owner
      .patch(`/api/budgets/${budget.id}/members/${alice.id}`)
      .send({ role: 'viewer' });
    expect(demote.status).toBe(409);

    const remove = await owner.delete(`/api/budgets/${budget.id}/members/${alice.id}`);
    expect(remove.status).toBe(409);
  });

  it('restricts member management to the owner', async () => {
    const owner = request.agent(app);
    const editor = request.agent(app);
    const editorUser = await signup(editor, 'editor@example.com');
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: editorUser.email, role: 'editor' });

    const res = await editor
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'someone@example.com', role: 'viewer' });
    expect(res.status).toBe(403);
  });

  it('returns an error when a member email has no account', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    const res = await owner
      .post(`/api/budgets/${budget.id}/members`)
      .send({ email: 'nobody@example.com', role: 'viewer' });
    expect(res.status).toBe(404);
  });

  it('lets the owner delete a budget', async () => {
    const owner = request.agent(app);
    await signup(owner, 'owner@example.com');
    const budget = await createBudget(owner, 'Household');
    const del = await owner.delete(`/api/budgets/${budget.id}`);
    expect(del.status).toBe(204);
    expect((await owner.get('/api/budgets')).body.budgets).toHaveLength(0);
  });
});