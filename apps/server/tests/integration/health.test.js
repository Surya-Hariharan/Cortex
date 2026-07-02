import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('GET /health', () => {
    it('boots the app and responds without touching Postgres', async () => {
        const app = createApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', env: 'test' });
    });
});

describe('unknown routes', () => {
    it('returns a JSON 404 instead of an HTML error page', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v1/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
    });
});

describe('authenticated routes', () => {
    it('rejects requests without a bearer token', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v1/users/me');
        expect(res.status).toBe(401);
    });
});
