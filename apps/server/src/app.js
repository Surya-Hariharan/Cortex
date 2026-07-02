const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Exported as a factory (not auto-listening) so tests can import and hit
// this app with supertest without binding a real port or touching Postgres
// unless a route actually queries the database.
function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.use(helmet());
    app.use(
        cors({
            origin: config.corsOrigins.length ? config.corsOrigins : false,
        })
    );
    app.use(express.json({ limit: '2mb' }));
    app.use(apiLimiter);

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', env: config.env });
    });

    app.use('/api/v1', routes);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
