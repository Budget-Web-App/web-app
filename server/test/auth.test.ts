import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetStore } from '../src/store';

const app = createApp();

const signupBody = {
  email: 'alice@example.com',
  password: 'supersecret',
  name: 'Alice',
};

beforeEach(() => resetStore());

describe('auth', () => {
  it('signs up a user and starts a session', async () => {
    const res = await request(app).post('/api/auth/signup').send(signupBody);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send(signupBody);
    const res = await request(app).post('/api/auth/signup').send(signupBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('rejects an invalid signup payload', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'short', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toBeDefined();
  });

  it('logs in and exposes the session user at /api/me', async () => {
    await request(app).post('/api/auth/signup').send(signupBody);
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: signupBody.password });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('alice@example.com');
  });

  it('rejects a wrong password', async () => {
    await request(app).post('/api/auth/signup').send(signupBody);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('requires auth at /api/me', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('logs out and invalidates the session', async () => {
    await request(app).post('/api/auth/signup').send(signupBody);
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: signupBody.password });
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    const me = await agent.get('/api/me');
    expect(me.status).toBe(401);
  });

  it('reports a consistent error shape at /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});