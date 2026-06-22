import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.js'],
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.{js,jsx}'],
            exclude: ['src/__tests__/**', 'src/main/**'],
        },
    },
});
