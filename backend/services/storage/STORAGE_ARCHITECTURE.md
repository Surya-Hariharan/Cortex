# Storage Architecture Documentation

## Overview

Cortex Phase 2D implements a **production-grade storage architecture** separating metadata from vector storage, enabling scalable embeddings, versioning, and mesh sync.

---

## Architecture Layers

### 1. **Metadata Store (SQLite)**
- **Purpose**: Relational data, document metadata, ownership tracking
- **Tables**:
  - `documents`: Core metadata, file hashes, timestamps
  - `chunks`: Content, versioning, device ownership
  - `devices`: Device registry for mesh networking
  - Legacy tables: `notes`, `projects`, `chats`, `chat_messages`
  - Mesh tables: `mesh_config`, `peers`, `peer_documents`

**Key Features**:
- File hash deduplication (SHA-256)
- Embedding version tracking per chunk
- Device ownership for mesh sync
- Full-text content encryption

### 2. **Vector Store (LanceDB)**
- **Purpose**: High-dimensional embeddings, similarity search
- **Collections**: Version-isolated (e.g., `embeddings_bge_small_v1`)
- **Schema**:
  ```javascript
  {
    chunk_id: string,          // deterministic ID
    vector: number[],          // 384-dim embedding
    doc_id: string,           // document reference
    owner_device: string,     // device that created it
    embedding_version: string // e.g., "bge-small-v1"
  }
  ```

**Key Features**:
- Approximate Nearest Neighbor (ANN) search
- Version-isolated collections (no mixing)
- Batch inserts for performance
- Scalable to 100k+ vectors

---

## Core Components

### `config.js`
- Embedding version constants
- LanceDB/SQLite configuration
- Chunking parameters
- Performance limits

### `hashUtils.js`
- SHA-256 file hashing
- Deterministic chunk ID generation
- String hashing utilities

### `metadataStore.js`
- SQLite wrapper with encryption
- Document/chunk CRUD operations
- Device management
- Version tracking queries
- Legacy compatibility methods

### `vectorStore.js`
- LanceDB wrapper
- Collection management (version-aware)
- Vector CRUD operations
- Similarity search with filtering
- Batch operations

### `indexer.js`
- Document processing pipeline
- File hash deduplication
- Batch embedding generation
- Coordinated metadata + vector storage
- Integrity verification

### `storageManager.js` (Public API)
- Unified storage interface
- Lifecycle management
- Search operations (text → embedding → vectors)
- Migration orchestration
- Health checks & statistics
- Legacy compatibility layer

### `migrations/vectorMigration.js`
- Version mismatch detection
- Controlled re-embedding pipeline
- Collection cleanup
- Migration planning tools

---

## Data Flow

### Indexing Pipeline
```
PDF File
  ↓ hashFile() → Check deduplication
  ↓ extractPdfText() → Chunking (512 chars, 50 overlap)
  ↓ aiManager.runEmbedding() → BGE-small-v1.5 (384D)
  ↓ generateChunkId() → Deterministic IDs
  ↓ 
  ├─→ SQLite: Store chunks metadata + content (encrypted)
  └─→ LanceDB: Store vectors in version-specific collection
```

### Query Pipeline
```
User Query
  ↓ aiManager.runEmbedding() → Query vector (384D)
  ↓ vectorStore.search() → ANN search (LanceDB)
  ↓ metadataStore.getChunk() → Enrich with content + metadata
  ↓ Return ranked results with scores
```

---

## Embedding Versioning System

### Current Version
```javascript
CURRENT_EMBEDDING_VERSION = 'bge-small-v1'
EMBEDDING_CONFIG = {
  model: 'bge-small-en-v1.5',
  dimensions: 384,
  normalization: 'L2'
}
```

### Version Isolation
- Each embedding version gets its own LanceDB collection
- Collection naming: `embeddings_<version>` (e.g., `embeddings_bge_small_v1`)
- **Never mix embeddings from different models**
- Queries are automatically filtered by version

### Migration Process
When `CURRENT_EMBEDDING_VERSION` changes:

1. **Detection**: `checkMigrationNeeded()` identifies outdated chunks
2. **Planning**: `getMigrationPlan()` estimates time and actions
3. **Execution**: `migrateAllDocuments()` re-embeds all chunks
   - Creates new LanceDB collection
   - Re-generates embeddings for all chunks
   - Updates SQLite version fields
   - Verifies integrity
4. **Cleanup**: `cleanupOldCollections()` removes old vectors

**Safety**:
- Old collections preserved until explicit cleanup
- Rollback requires database restore from backup
- Progress callbacks for long migrations

---

## File Integrity & Deduplication

### File Hashing
- **Algorithm**: SHA-256
- **Purpose**: Detect duplicate files before indexing
- **Storage**: `documents.file_hash` (unique constraint)

### Workflow
```javascript
const fileHash = await hashFile(filePath);
if (metadataStore.documentExistsByHash(fileHash)) {
  return { skipped: true, reason: 'Duplicate file hash' };
}
// Proceed with indexing...
```

**Benefits**:
- Prevents redundant indexing
- Mesh sync conflict resolution
- Version control awareness

---

## Deterministic Chunk IDs

### Generation
```javascript
chunkId = hash(doc_id + chunk_index + embedding_version)
```

**Why Deterministic?**
- Consistent IDs across devices (mesh sync)
- Re-embedding detection (same content → same ID)
- Reconciliation in P2P networks

**Example**:
```javascript
docId = "doc_a1b2c3d4e5f6g7h8"
chunkIndex = 0
embeddingVersion = "bge-small-v1"
→ chunkId = "e4d3c2b1a098765432..."
```

---

## Mesh Sync Preparation

### Schema Extensions
- `chunks.owner_device`: Device that created the chunk
- `chunks.last_synced`: Timestamp for sync tracking
- `devices` table: Device registry
- `peer_documents`: Remote document metadata

### Future CRDT Support
- Device-aware vector merging
- Ownership tracking for conflict resolution
- Timestamp-based reconciliation
- **Not yet implemented** (Phase 2E)

---

## Performance Considerations

### Scalability Targets
- **Documents**: 10,000+
- **Chunks**: 100,000+
- **Vectors**: 100,000+

### Optimizations
1. **Batch Inserts**: 50-100 chunks/vectors per transaction
2. **Lazy Loading**: Don't load all vectors into memory
3. **Indexed Queries**: SQLite indexes on key columns
4. **WAL Mode**: Concurrent reads on SQLite
5. **ANN Search**: LanceDB approximate nearest neighbor (sub-second)

### Memory Management
- `getAllEmbeddings()` deprecated (loads everything)
- Use `search()` with limit instead
- Vectors not fetched unless needed

---

## Storage API Usage

### Initialization
```javascript
const { storageManager } = require('./storage/storageManager');

await storageManager.initialize('/path/to/data');
```

### Index Document
```javascript
const result = await storageManager.indexDocument(
  '/path/to/document.pdf',
  'Document Title',
  (progress) => console.log(progress)
);
// result: { success, docId, chunkCount, timeMs, ... }
```

### Search
```javascript
// Text query (auto-embedding)
const results = await storageManager.searchByText('quantum mechanics', 10);

// Or with pre-computed vector
const queryVector = await aiManager.runEmbedding('quantum mechanics');
const results = await storageManager.search(queryVector, 10);

// results: [{ chunk_id, doc_id, title, content, score, ... }]
```

### Migration
```javascript
// Check if needed
const migrationInfo = storageManager.checkMigration();
if (migrationInfo) {
  console.log(`Migration required for ${migrationInfo.affectedChunks} chunks`);
  
  // Get detailed plan
  const plan = storageManager.getMigrationPlan();
  console.log(plan);
  
  // Execute migration
  await storageManager.migrateAll((docIndex, total, status) => {
    console.log(`Migrating ${docIndex}/${total}: ${status}`);
  });
}
```

### Statistics
```javascript
const stats = await storageManager.getStats();
// stats: { documents, chunks, vectors, embeddingVersion, ... }

const health = await storageManager.getHealthStatus();
// health: { healthy, storage, integrity, vectorStore, migration, ... }
```

---

## Migration from Old Architecture

### Old (Phase 2C and earlier)
```javascript
// SQLite stores everything
db.insertDocument(title, subject, content, chunkIndex);
db.insertEmbedding(docId, vector); // BLOB in SQLite

// In-memory vector search
const allEmbeddings = db.getAllEmbeddings(); // ❌ Loads everything
searchVectors(queryVector, allEmbeddings, 5);
```

### New (Phase 2D)
```javascript
// Storage manager handles complexity
await storageManager.indexDocument(filePath, title);

// Efficient vector search
const results = await storageManager.searchByText(query, 5); // ✅ Scalable
```

### Backward Compatibility
The old `database.js` API is preserved via `storageManager` wrapper:
- `db.getAllEmbeddings()` → now deprecated but functional
- `db.insertNote()` → forwarded to metadataStore
- All legacy methods still work

**Migration Strategy**:
1. Phase 2D: Introduce new storage layer, maintain compatibility
2. Phase 2E: Update UI to use new APIs
3. Phase 2F: Remove deprecated methods

---

## Error Handling

### Common Errors
1. **Dimension Mismatch**
   ```javascript
   Error: Vector dimension mismatch: expected 384, got 768
   ```
   → Embedding model changed, migration needed

2. **Storage Not Ready**
   ```javascript
   Error: StorageManager not initialized
   ```
   → Call `storageManager.initialize()` first

3. **Duplicate File Hash**
   ```javascript
   { skipped: true, reason: 'Already indexed (duplicate file hash)' }
   ```
   → File already in database, no action needed

4. **Migration Required**
   ```javascript
   { migrationRequired: true, outdatedVersions: ['bge-small-v0'] }
   ```
   → Run `storageManager.migrateAll()`

---

## File Structure

```
backend/services/storage/
├── config.js                      # Constants & configuration
├── hashUtils.js                   # Hashing utilities
├── metadataStore.js               # SQLite wrapper
├── vectorStore.js                 # LanceDB wrapper
├── indexer.js                     # Document processing pipeline
├── storageManager.js              # Public API (use this!)
├── migrations/
│   └── vectorMigration.js         # Version upgrade tools
└── STORAGE_ARCHITECTURE.md        # This file
```

---

## Testing Checklist

### Unit Tests
- [ ] File hashing produces consistent results
- [ ] Deterministic chunk IDs for same input
- [ ] Duplicate file detection works
- [ ] Vector dimension validation
- [ ] Version mismatch detection

### Integration Tests
- [ ] Index document end-to-end
- [ ] Search returns relevant results
- [ ] Migration preserves data
- [ ] Batch operations complete successfully
- [ ] Legacy API compatibility

### Performance Tests
- [ ] Index 100 documents < 5 minutes
- [ ] Search 10k vectors < 100ms
- [ ] Batch insert 1000 vectors < 2 seconds
- [ ] Memory usage stays reasonable (< 500MB for 10k docs)

### Mesh Sync Tests (Phase 2E)
- [ ] Deterministic IDs match across devices
- [ ] Ownership tracking works
- [ ] Conflict detection accurate

---

## Best Practices

### DO ✅
- Use `storageManager.searchByText()` for queries
- Check `storageManager.isReady()` before operations
- Run `storageManager.verifyIntegrity()` after migration
- Use batch operations for multiple documents
- Handle `skipped: true` results gracefully

### DON'T ❌
- Don't call `getAllEmbeddings()` in production (deprecated)
- Don't mix embedding versions manually
- Don't delete collections without migration
- Don't modify `CURRENT_EMBEDDING_VERSION` without planning
- Don't skip file hash checks

---

## Future Enhancements (Phase 2E+)

1. **CRDT Integration**: Real-time collaborative editing
2. **Incremental Sync**: Only sync changed chunks
3. **Compression**: Reduce vector storage size
4. **Multi-Model Support**: Switch models per document
5. **Hybrid Search**: Combine vector + keyword search
6. **Quantization**: Faster search with acceptable accuracy loss

---

## Troubleshooting

### Slow search
- Check vector count: `await storageManager.getStats()`
- If > 100k vectors, consider filtering or limiting results
- Verify LanceDB collection exists

### Integrity mismatch
```javascript
const integrity = await storageManager.verifyIntegrity();
if (!integrity.healthy) {
  // Option 1: Reindex affected documents
  // Option 2: Full migration
  await storageManager.migrateAll();
}
```

### Migration stuck
- Check progress logs
- Verify disk space available
- Ensure AI embeddings service running
- Consider migrating in batches

---

## Production Deployment

### Pre-Deployment
1. Backup existing database: `cp cortex.db cortex.db.backup`
2. Test migration on backup: `storageManager.migrateAll()`
3. Verify integrity: `storageManager.verifyIntegrity()`
4. Check disk space: LanceDB needs ~4KB per vector

### Post-Deployment
1. Monitor integrity: `storageManager.getHealthStatus()`
2. Track migration status: `storageManager.checkMigration()`
3. Clean old collections after verification

---

## Engineering Principles

> **Storage design determines system lifespan.**
> 
> **Bad storage = future rewrite.**
> 
> **Good storage = future flexibility.**

This architecture enables:
- Embedding model upgrades without data loss
- Multi-device mesh networking
- Scalability to research-grade datasets
- Future AI model improvements

---

**Phase 2D: Production Storage Architecture ✅**

Next: Phase 2E — Document Content Sync + CRDT Collaborative Editing
