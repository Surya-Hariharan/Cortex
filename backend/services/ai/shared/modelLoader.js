const fs = require('fs');
const path = require('path');

/**
 * Model Loader Utilities
 * Provides helper functions for loading and validating model files
 */

/**
 * Check if a model file exists
 * @param {string} modelPath - Path to model file
 * @returns {boolean} True if file exists
 */
function modelExists(modelPath) {
    return fs.existsSync(modelPath);
}

/**
 * Validate model directory structure
 * @param {string} modelDir - Directory containing model files
 * @param {Array<string>} requiredFiles - List of required files
 * @returns {Object} { valid: boolean, missing: Array<string> }
 */
function validateModelDir(modelDir, requiredFiles = ['model.onnx']) {
    const missing = [];

    for (const file of requiredFiles) {
        const filePath = path.join(modelDir, file);
        if (!fs.existsSync(filePath)) {
            missing.push(file);
        }
    }

    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Get model file info
 * @param {string} modelPath - Path to model file
 * @returns {Object|null} File stats or null if not found
 */
function getModelInfo(modelPath) {
    if (!fs.existsSync(modelPath)) {
        return null;
    }

    const stats = fs.statSync(modelPath);
    return {
        path: modelPath,
        sizeBytes: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        modified: stats.mtime
    };
}

/**
 * Resolve model path relative to project root
 * @param {string} relativePath - Relative path from project root
 * @returns {string} Absolute path
 */
function resolveModelPath(relativePath) {
    // Assuming we're in backend/services/ai/shared/
    // Go up to project root: ../../../../
    return path.join(__dirname, '../../../../', relativePath);
}

/**
 * List available models in models directory
 * @param {string} modelsDir - Root models directory
 * @returns {Array<string>} List of model directories
 */
function listAvailableModels(modelsDir) {
    if (!fs.existsSync(modelsDir)) {
        return [];
    }

    return fs.readdirSync(modelsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

/**
 * Get model metadata from config file if available
 * @param {string} modelDir - Model directory
 * @returns {Object|null} Metadata or null
 */
function getModelMetadata(modelDir) {
    const configPath = path.join(modelDir, 'config.json');
    
    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
        console.error('[ModelLoader] Failed to parse config.json:', error);
        return null;
    }
}

module.exports = {
    modelExists,
    validateModelDir,
    getModelInfo,
    resolveModelPath,
    listAvailableModels,
    getModelMetadata
};
