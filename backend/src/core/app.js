/**
 * Cortex — Application Orchestrator
 * Handles strict startup sequencing and service initialization.
 */

const path = require('path');
const { initializeDatabase } = require('../storage/dbInit');
const { storageManager } = require('../storage/storageManager');
const { aiManager } = require('../ai/runtime/aiManager');
const { createMeshManager } = require('../mesh/meshManager');
const { mountRoutes } = require('./routes');
const fs = require('fs');

async function bootstrapper(app) {
    console.log('[Cortex] Starting backend services...');

    // Define core directories
    const rootDir = path.join(__dirname, '../../..');
    const dataDir = path.join(rootDir, 'data');
    const publicDir = path.join(rootDir, 'frontend/public');
    const uploadsDir = path.join(dataDir, 'uploads');

    // Create necessary directories
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Step 1: Database & Storage Layer Initialization
    console.log('[Cortex] Step 1: Initializing Database & Storage...');
    let db;
    try {
         db = await initializeDatabase(dataDir);
    } catch (e) {
        console.error('[Cortex] Fatal error initializing database:', e);
        throw e;
    }

    // Step 2: AI Runtime Bootstrapping
    console.log('[Cortex] Step 2: Bootstrapping AI Runtime...');
    try {
        await aiManager.initialize();
    } catch (e) {
        console.error('[Cortex] AI initialization failed, running with limited functionality:', e);
    }

    // Step 3: Mesh Network Initialization (Optional/Lazy)
    console.log('[Cortex] Step 3: Initializing Mesh Network...');
    try {
        const deviceId = storageManager.isReady() ? storageManager.config.deviceId : 'unknown';
        const meshManager = createMeshManager(db);
        await meshManager.start(deviceId);
    } catch (e) {
        console.error('[Cortex] Mesh networking failed to start:', e);
    }

    // Step 4: Mount Application Routes
    console.log('[Cortex] Step 4: Mounting API Routes...');
    const services = {
        database: db,
        storageManager,
        aiManager,
        meshManager: createMeshManager(db), // get the instance
        publicDir,
        uploadsDir
    };

    mountRoutes(app, services);

    console.log('[Cortex] ✓ All services successfully initialized.');
    return services;
}

module.exports = { bootstrapper };
