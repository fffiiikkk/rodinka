/**
 * Integration tests for health and basic API endpoints.
 * Requires DATABASE_URL to be set in the environment.
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Application } from 'express';

let app: Application;

beforeAll(async () => {
  // Only run if DATABASE_URL is set (skip in unit test mode)
  if (!process.env['DATABASE_URL']) {
    return;
  }
  app = await createApp();
});

afterAll(async () => {
  // Cleanup if needed
});

describe('Health endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    if (!process.env['DATABASE_URL']) {
      console.log('Skipping integration tests: no DATABASE_URL');
      return;
    }
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /health includes version and environment', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('environment');
  });
});

describe('Auth endpoints', () => {
  it('POST /api/auth/login with missing credentials returns 400', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login with wrong credentials returns 401', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'wrongpass123' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me without session returns 401', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Protected routes', () => {
  it('GET /api/events without auth returns 401', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('GET /api/users without auth returns 401', async () => {
    if (!process.env['DATABASE_URL']) return;
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
