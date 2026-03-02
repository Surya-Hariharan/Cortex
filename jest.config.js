module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.js'],
  roots: ['<rootDir>/backend/tests'],
  testMatch: ['**/?(*.)+(spec|test).js'],
  clearMocks: true,
  silent: false,
  verbose: true,
  testTimeout: 60000,
  transform: {}, // Disable babel transpilation for native C++ bindings and ESM pdfjs-dist
};
