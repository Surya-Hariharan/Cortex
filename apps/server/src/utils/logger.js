// Minimal structured logger. Swap for pino/winston later without touching callers.
const level = (label) => (...args) => {
    // eslint-disable-next-line no-console
    console[label === 'error' ? 'error' : 'log'](`[cortex-server] [${label}]`, ...args);
};

module.exports = {
    info: level('info'),
    warn: level('warn'),
    error: level('error'),
};
