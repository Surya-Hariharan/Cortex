// @vitest-environment node
// Importing authData.js executes all the exported data statements,
// giving near-100% statement coverage for that file.

import { describe, it, expect } from 'vitest';
import * as authData from '../renderer/constants/authData.js';

describe('authData', () => {
    it('exports DISTRICTS_TN as a non-empty array of strings', () => {
        expect(Array.isArray(authData.DISTRICTS_TN)).toBe(true);
        expect(authData.DISTRICTS_TN.length).toBeGreaterThan(0);
        expect(typeof authData.DISTRICTS_TN[0]).toBe('string');
    });

    it('exports STREAMS or other data constants', () => {
        const keys = Object.keys(authData);
        expect(keys.length).toBeGreaterThan(0);
    });

    it('all exported values are defined', () => {
        for (const [key, value] of Object.entries(authData)) {
            expect(value).toBeDefined();
        }
    });
});
