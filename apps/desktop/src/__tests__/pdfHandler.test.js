// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

describe('pdf-parse loading diagnostic', () => {
    it('loads pdf-parse without hanging', () => {
        const pdfParse = _require('pdf-parse');
        expect(typeof pdfParse).toBe('function');
    });
});
