// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { chunkText, extractPdfText } from '../services/storage/pdfHandler.js';

// Factory must return an object (not a function) to avoid a Node CJS loader crash
// when vitest intercepts the lazy require() inside extractPdfText at runtime.
// pdfHandler.js handles this via `pdfParseModule.default || pdfParseModule`.
const mockPdfParse = vi.fn().mockResolvedValue({ text: 'Test PDF text.' });
vi.mock('pdf-parse', () => ({ default: mockPdfParse }));

// Step 1: does adding createRequire and _fs spy cause a hang?
describe('extractPdfText basic', () => {
    const _require = createRequire(import.meta.url);
    const _fs = _require('fs');
    let orig;

    beforeEach(() => {
        orig = _fs.readFileSync;
        _fs.readFileSync = vi.fn().mockReturnValue(Buffer.from('fake'));
    });
    afterEach(() => {
        _fs.readFileSync = orig;
        vi.clearAllMocks();
    });

    it('reads the file', async () => {
        await extractPdfText('/test.pdf');
        expect(_fs.readFileSync).toHaveBeenCalledWith('/test.pdf');
    });
});
