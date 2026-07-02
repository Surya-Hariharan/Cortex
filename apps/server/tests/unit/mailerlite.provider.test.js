import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const config = require('../../src/config/index.js');
const mailerlite = require('../../src/services/providers/mailerlite.provider.js');

describe('mailerlite.provider', () => {
    let originalApiKey;
    let originalFetch;

    beforeEach(() => {
        originalApiKey = config.mailerlite.apiKey;
        config.mailerlite.apiKey = 'test-key';
        originalFetch = global.fetch;
    });

    afterEach(() => {
        config.mailerlite.apiKey = originalApiKey;
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('drops the email without throwing when no API key is configured', async () => {
        config.mailerlite.apiKey = '';
        global.fetch = vi.fn();

        await mailerlite.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends successfully on the first attempt', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true });

        await mailerlite.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toBe('https://connect.mailerlite.com/api/emails');
        expect(opts.headers.Authorization).toBe('Bearer test-key');
        expect(JSON.parse(opts.body).to).toEqual([{ email: 'a@b.com' }]);
    });

    it('retries on failure and eventually succeeds, without throwing', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' })
            .mockResolvedValueOnce({ ok: true });

        await expect(mailerlite.send({ to: 'a@b.com', subject: 'Hi', html: 'h', text: 't' })).resolves.toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('gives up silently (never throws) after exhausting retries', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'down' });

        await expect(mailerlite.send({ to: 'a@b.com', subject: 'Hi', html: 'h', text: 't' })).resolves.toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
