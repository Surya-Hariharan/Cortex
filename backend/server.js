/**
 * Cortex — Backend Entry Point
 * Thin wrapper that initializes Express and invokes the Application Orchestrator.
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Global middleware
app.use(cors());
app.use(express.json());

// Bootup Orchestrator
const { bootstrapper } = require('./src/core/app');

async function start() {
    try {
        await bootstrapper(app);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[Cortex] ✓ Server running on http://localhost:${PORT}`);
            console.log(`[Cortex]   Open http://localhost:${PORT} in your browser`);
        });
    } catch (err) {
        console.error('[Cortex] Fatal error starting server:', err);
        process.exit(1);
    }
}

start();
