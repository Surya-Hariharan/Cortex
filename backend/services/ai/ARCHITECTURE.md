# Cortex AI Runtime Architecture

## Overview

The AI layer has been refactored into a modular runtime architecture that decouples the UI from model implementations and prepares the system for multi-model, multi-hardware support.

**Architecture Principle:**
```
Models are plugins.
Runtime is orchestrator.
UI is consumer.
```

## Directory Structure

```
backend/services/ai/
├── runtime/
│   ├── aiManager.js          # Single public AI entry point
│   ├── hardwareDetector.js   # Hardware capability detection
│   └── sessionRegistry.js    # Centralized ONNX session manager
│
├── embeddings/
│   └── bgeRunner.js          # BGE embedding model runner
│
├── llm/
│   └── phiRunner.js          # Phi-3 LLM runner
│
├── shared/
│   ├── tokenizer.js          # Shared tokenization utilities
│   └── modelLoader.js        # Model loading helpers
│
└── rag/
    └── promptBuilder.js      # RAG prompt construction
```

## Key Components

### 1. AI Manager (`aiManager.js`)

**Single Public AI Entry Point**

The ONLY interface between UI and AI models. UI components must NEVER import model-specific files directly.

**Public API:**
```javascript
// Generate embedding for text
await aiManager.runEmbedding(text)

// Run LLM with streaming
await aiManager.runLLM(prompt, onTokenCallback)

// Get comprehensive runtime metadata
aiManager.getRuntimeInfo()

// Future: Remote LLM inference (Phase 2C)
await aiManager.runRemoteLLM(prompt, peerId) // Not implemented yet
```

**Benefits:**
- Clean abstraction between UI and models
- Easy model swapping without UI changes
- Centralized performance tracking
- Multi-model support

### 2. Hardware Detector (`hardwareDetector.js`)

**Hardware Capability Detection**

Automatically detects available acceleration providers:
- CPU (fallback)
- DirectML (AMD Ryzen AI NPU, Intel GPU, AMD GPU)
- CUDA (NVIDIA GPU, if available)

**Capabilities:**
```javascript
const caps = await hardwareDetector.detect();
// Returns:
{
  provider: 'directml',           // Best available provider
  deviceName: 'AMD Ryzen AI NPU', // Hardware description
  supportsFP16: true,             // FP16 support
  supportsDirectML: true,         // DirectML available
  supportsGPU: false,             // CUDA available
  availableProviders: ['dml', 'cpu'],
  system: {
    platform: 'win32',
    arch: 'x64',
    cpus: 16,
    totalMemoryGB: 32,
    freeMemoryGB: 16
  }
}
```

### 3. Session Registry (`sessionRegistry.js`)

**Centralized ONNX Session Manager**

Critical for preventing performance issues:

**Prevents:**
- Model reload per query
- Memory explosion
- Latency spikes

**Features:**
- Caches loaded ONNX sessions
- Prevents duplicate model loads
- Enables session reuse across queries
- Supports lazy loading
- Tracks inference metrics

**Usage:**
```javascript
// Models use session registry automatically
const sessionData = await sessionRegistry.getSession(
  'bge-small-en-v1.5',
  modelPath,
  options
);

// Session is cached and reused for subsequent calls
```

### 4. BGE Runner (`embeddings/bgeRunner.js`)

**BGE Embedding Model Runner**

Isolated embedding model implementation:
- Uses session registry for efficiency
- Clean `run()` interface
- No direct ONNX imports from UI
- Performance tracking

**Key Methods:**
```javascript
const runner = new BGERunner(modelDir);
await runner.initialize();
const embedding = await runner.run(text); // Returns 384-dim vector
const stats = runner.getPerfStats();
```

### 5. Phi Runner (`llm/phiRunner.js`)

**Phi-3 LLM Runner**

Text generation model runner:
- Streaming token generation
- Performance metrics (TTFT, tokens/sec)
- Lazy initialization

**Key Methods:**
```javascript
const runner = new PhiRunner();
await runner.initialize();
const result = await runner.generateStream(prompt, onTokenCallback);
// Returns: { text, stats }
```

### 6. Shared Utilities

**Tokenizer (`shared/tokenizer.js`)**
- Reusable tokenization logic
- Supports HuggingFace tokenizer.json
- Fallback hash-based tokenizer

**Model Loader (`shared/modelLoader.js`)**
- Model validation helpers
- File existence checks
- Model metadata extraction

## Data Flow

### Embedding Generation
```
UI → IPC → aiManager.runEmbedding()
         → BGERunner.run()
         → SessionRegistry.getSession() [caches ONNX session]
         → ONNX Runtime inference
         → Returns 384-dim vector
```

### LLM Inference
```
UI → IPC → aiManager.runLLM()
         → PhiRunner.generateStream()
         → Transformers.js pipeline
         → Streams tokens via callback
         → Returns { text, stats }
```

### Performance Monitoring
```
UI → IPC → get-perf-stats
         → aiManager.getRuntimeInfo()
         → Collects metrics from:
             - BGERunner.getPerfStats()
             - PhiRunner.getPerfStats()
             - SessionRegistry.getMemoryStats()
             - HardwareDetector.getCapabilities()
         → Returns comprehensive runtime metadata
```

## Isolation Rules

**STRICT ENFORCEMENT:**

❌ **Disallowed:**
- UI importing ONNX runtime
- UI importing model paths
- UI referencing model names directly
- Direct model instantiation outside runners

✅ **Required:**
- All AI logic passes through `aiManager`
- Models accessed only via runner abstractions
- UI uses IPC handlers only

## Benefits of This Architecture

### 1. Model Swapping
Want to replace BGE with a different embedding model?
- Create new runner in `embeddings/`
- Update `aiManager` to instantiate it
- UI code unchanged ✓

### 2. Multi-Hardware Support
- Hardware detection automatic
- Session registry optimizes provider selection
- Same code runs on CPU, GPU, or NPU

### 3. Performance Optimization
- Sessions cached and reused
- No duplicate model loads
- Efficient memory management
- Detailed performance tracking

### 4. Future-Ready
- Placeholder for remote LLM (mesh inference)
- Easy to add new model types
- Extensible runner pattern
- Clean separation of concerns

## Runtime Metadata

The `getRuntimeInfo()` method provides comprehensive system information:

```javascript
{
  models: {
    embedding: {
      name: 'bge-small-en-v1.5',
      type: 'embedding',
      provider: 'directml',
      ready: true,
      performance: {
        lastInferenceMs: 12,
        avgInferenceMs: 15,
        speedupX: 2.7,
        inferenceCount: 42
      }
    },
    llm: {
      name: 'Phi-3-mini-4k-instruct',
      type: 'text-generation',
      provider: 'cpu',
      ready: true,
      performance: {
        loadTimeMs: 2450,
        ttftMs: 123,
        tokensPerSec: 15.3,
        inferenceCount: 5
      }
    }
  },
  hardware: {
    provider: 'directml',
    deviceName: 'AMD Ryzen AI NPU',
    supportsFP16: true,
    ...
  },
  runtime: {
    activeSessions: 1,
    estimatedMemoryMB: 100,
    sessions: [...]
  },
  status: {
    initialized: true,
    embeddingReady: true,
    llmReady: true
  }
}
```

This can be displayed in the Performance tab for transparency.

## Migration Notes

### Before (Phase 2A)
```javascript
// Direct model imports everywhere
const { EmbeddingsEngine } = require('./embeddings');
const embedder = new EmbeddingsEngine(modelDir);
await embedder.initialize();
const vec = await embedder.embed(text);
```

### After (Phase 2B)
```javascript
// Clean abstraction via aiManager
const vec = await aiManager.runEmbedding(text);
```

**UI behavior is identical. Internals are cleaner.**

## Phase 2C Preview (Future)

The architecture now supports future mesh inference:

```javascript
// Remote LLM inference across peer network
await aiManager.runRemoteLLM(prompt, peerId);
```

Currently throws "Not Implemented" - will be added in Phase 2C.

## Testing

The refactored system should behave identically to the previous version:
- ✓ Embeddings work the same
- ✓ Search produces same results
- ✓ LLM generation unchanged
- ✓ Performance monitoring enhanced

**No UI changes required.**

## Summary

This refactoring achieves:
- ✓ Decoupled UI from model implementations
- ✓ Multi-model, multi-hardware ready
- ✓ Session caching and reuse
- ✓ Hardware detection layer
- ✓ Clean abstraction boundaries
- ✓ Performance optimization
- ✓ Future-proof architecture

**The system is now production-ready for Phase 2C (mesh inference) and beyond.**
