# Cortex Mesh Networking Architecture (Phase 2C)

## Overview

Real peer-to-peer mesh networking implementation using **libp2p** for local network discovery and secure document metadata exchange.

**Status:** Phase 2C - Connectivity Layer Only
- ✅ Peer discovery (mDNS)
- ✅ Secure encrypted channels (Noise protocol)
- ✅ Metadata exchange
- ❌ Full document sync (Future phase)
- ❌ CRDT collaboration (Future phase)

## Architecture

```
UI → MeshManager → MeshNode → libp2p → Network
```

**Isolation Rules:**
- Mesh module does NOT call AI runtime
- Mesh module does NOT modify vector database directly
- Mesh module does NOT control UI directly
- Only handles networking and metadata exchange

## Directory Structure

```
backend/services/mesh/
├── meshManager.js       # Public API - UI interface
├── meshNode.js          # libp2p core implementation
├── protocolHandlers.js  # Custom libp2p protocols
├── documentSync.js      # Metadata preparation & validation
└── crypto.js            # Crypto utilities
```

## Components

### 1. Mesh Manager (`meshManager.js`)

**Public API for mesh networking**

```javascript
const { createMeshManager } = require('./services/mesh/meshManager');

const meshManager = createMeshManager(database);

// Start mesh network
await meshManager.start();

// Get discovered peers
const peers = meshManager.getPeers();

// Get peer documents (metadata only)
const docs = meshManager.getPeerDocuments(peerId);

// Request document (stub - not implemented)
try {
    await meshManager.requestDocument(peerId, docId);
} catch (error) {
    // Will throw "Not Implemented"
}

// Get network status
const status = meshManager.getStatus();

// Stop mesh network
await meshManager.stop();
```

**Callbacks:**
```javascript
// Notify UI when peers change
meshManager.onPeersChanged = (peers) => {
    // Send to UI
};
```

### 2. Mesh Node (`meshNode.js`)

**libp2p implementation with:**
- **Transport:** TCP for reliable connections
- **Discovery:** mDNS for local network peer discovery
- **Encryption:** Noise protocol for secure communication
- **Multiplexing:** Yamux for stream multiplexing

**Features:**
- Auto-start on app launch
- Persistent peer ID (stored in SQLite)
- Automatic peer discovery and connection
- Protocol handler registration
- Connection lifecycle management

**Event Handling:**
```javascript
// Peer discovered via mDNS
node.addEventListener('peer:discovery', handler);

// Peer connected
node.addEventListener('peer:connect', handler);

// Peer disconnected
node.addEventListener('peer:disconnect', handler);
```

### 3. Protocol Handlers (`protocolHandlers.js`)

**Custom libp2p protocols:**

#### `/cortex/handshake/1.0.0`
Initial connection handshake - exchange basic peer info

**Request:**
```json
{
  "peerId": "12D3KooW...",
  "deviceName": "User's Laptop",
  "docCount": 132,
  "version": "1.0.0"
}
```

**Response:**
```json
{
  "peerId": "12D3KooW...",
  "deviceName": "Other Device",
  "docCount": 89,
  "version": "1.0.0"
}
```

#### `/cortex/metadata/1.0.0`
Document metadata exchange

**Request:**
```json
{
  "type": "request",
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "type": "response",
  "documents": [
    {
      "docId": "abc123",
      "title": "Sample Document",
      "subject": "Computer Science",
      "embeddingVersion": "bge-small-v1.5",
      "chunkCount": 45,
      "lastModified": 1234567890
    }
  ],
  "timestamp": 1234567890
}
```

#### `/cortex/request/1.0.0`
Document content request (STUB - Not implemented)

**Response:**
```json
{
  "error": "NOT_IMPLEMENTED",
  "message": "Document content transfer not implemented yet..."
}
```

### 4. Document Sync (`documentSync.js`)

**Metadata preparation and validation**

```javascript
// Prepare local documents for sharing
const metadata = prepareDocumentMetadata(db);

// Validate incoming metadata
const isValid = validateDocumentMetadata(metadata);

// Store peer documents in database
const stored = storePeerDocuments(db, peerId, metadataList);

// Get peer documents
const docs = getPeerDocuments(db, peerId);

// Request full document (stub)
await requestDocument(peerId, docId); // throws "Not Implemented"
```

**Metadata Format:**
```javascript
{
  docId: "string",           // Unique document identifier
  title: "string",           // Document title
  subject: "string",         // Subject/category (optional)
  embeddingVersion: "string", // e.g., "bge-small-v1.5"
  chunkCount: number,        // Number of chunks
  lastModified: number       // Unix timestamp
}
```

### 5. Crypto Utilities (`crypto.js`)

**Application-level crypto primitives**

Note: Transport-level encryption is handled by Noise protocol in libp2p

```javascript
// Generate persistent peer ID seed
const seed = generatePeerSeed();

// Hash data
const hash = hashData(content);

// Generate document ID
const docId = generateDocumentId(title, content, timestamp);

// Verify checksum
const valid = verifyChecksum(data, checksum);

// Sign message (HMAC-based)
const signed = signMessage(message, secret);

// Verify signature
const valid = verifySignature(signedMessage, secret);
```

## Database Schema

### Mesh Configuration
```sql
CREATE TABLE mesh_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Stores persistent peer ID for consistent identity across restarts.

### Peers
```sql
CREATE TABLE peers (
  peer_id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  doc_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Tracks discovered peers and their metadata.

### Peer Documents
```sql
CREATE TABLE peer_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peer_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'Unknown',
  chunk_count INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peer_id) REFERENCES peers(peer_id) ON DELETE CASCADE,
  UNIQUE(peer_id, doc_id)
);
```

Stores metadata of documents shared by peers. **No actual content stored.**

## Data Flow

### Peer Discovery Flow
```
1. App starts → MeshManager.start()
2. MeshNode creates libp2p instance
3. mDNS broadcasts presence on LAN
4. Other peers discovered via mDNS
5. Peer stored in database
6. Connection established
7. Handshake protocol exchange
8. Metadata protocol exchange
9. Peer documents stored in database
10. UI notified via callback
```

### Metadata Exchange Flow
```
Peer A                          Peer B
  |                               |
  |------ TCP Connection -------->|
  |<----- Noise Encryption ------>|
  |                               |
  |-- /cortex/handshake/1.0.0 -->|
  |<-- Device info response ------|
  |                               |
  |-- /cortex/metadata/1.0.0 ---->|
  |<-- Document metadata list ----|
  |                               |
  [Store in peer_documents table]
  [Notify UI]
```

### Document Request Flow (Future)
```
Currently:
User → Request Document → "Not Implemented" Error

Future Phase:
User → Request Document → 
  Stream chunks → 
  Verify integrity → 
  Store locally → 
  Generate embeddings →
  Add to vector database
```

## IPC Handlers

### Get Peers
```javascript
const result = await window.electronAPI.getPeers();
// Returns: { peers: [...] }
```

### Get Peer Documents
```javascript
const result = await window.electronAPI.getPeerDocuments(peerId);
// Returns: { documents: [...] }

// Or get all peer documents
const result = await window.electronAPI.getPeerDocuments();
```

### Request Document (Stub)
```javascript
const result = await window.electronAPI.requestPeerDocument(peerId, docId);
// Returns: { error: "...", notImplemented: true }
```

### Get Mesh Status
```javascript
const status = await window.electronAPI.getMeshStatus();
// Returns:
{
  running: true,
  peerId: "12D3KooW...",
  connections: 2,
  discoveredPeers: 3,
  listenAddrs: [...]
}
```

### Listen for Peer Updates
```javascript
window.electronAPI.onPeersUpdated((peers) => {
    // Update UI with new peer list
});

// Cleanup
window.electronAPI.removePeersUpdatedListener();
```

## Fault Tolerance

**Handled Scenarios:**

1. **Peer Disconnect**
   - Event captured
   - Status updated
   - UI notified
   - No crash

2. **Network Drop**
   - mDNS continues scanning
   - Reconnects automatically
   - Peer status marked offline

3. **Duplicate Discovery**
   - Peer ID uniqueness enforced
   - Database upsert prevents duplicates
   - Only one connection per peer

4. **Corrupt Metadata**
   - Validation before storage
   - Invalid metadata logged and skipped
   - Does not break sync

5. **Protocol Errors**
   - Try-catch on all protocol handlers
   - Stream cleanup on error
   - Connection maintained

## Security

### Transport Layer
- **Noise Protocol:** Authenticated encryption for all connections
- **mDNS:** Local network only (not internet-routable)
- **No Central Server:** Fully peer-to-peer, no cloud dependencies

### Application Layer
- **Metadata Only:** No document content transferred yet
- **Validation:** All incoming metadata validated before storage
- **Peer ID Persistence:** Consistent identity across sessions

### Future Considerations (Phase 2D+)
- Document content encryption
- Peer authentication/allowlist
- Content-addressed storage
- CRDT conflict resolution

## Performance

### Network
- **mDNS Interval:** 5 seconds
- **Auto-dial:** Enabled for discovered peers
- **Max Connections:** 50 concurrent peers
- **Min Connections:** 0 (optional)

### Database
- **Indexes:** peer_id, last_modified
- **Unique Constraints:** (peer_id, doc_id) prevents duplicates
- **Cascade Delete:** Peer removal cleans up documents

### Memory
- **Session Reuse:** libp2p manages connection pooling
- **Lazy Loading:** Peers discovered on-demand
- **Cleanup:** Periodic removal of stale peers

## Testing

### Manual Testing
1. Start two Cortex instances on same LAN
2. Check Network tab for discovered peers
3. Verify peer information displayed
4. Check console for connection logs
5. Verify document metadata appears

### Console Logs
```
[MeshNode] Initializing libp2p node...
[MeshNode] Peer ID: 12D3KooW...
[MeshNode] Listening on: /ip4/192.168.1.10/tcp/54321
[MeshNode] Started successfully
[MeshNode] Discovered peer: 12D3KooW...
[MeshNode] Connected to peer: 12D3KooW...
[Protocol] Handshake complete with User's Laptop
[Protocol] Received 45 document metadata entries
[DocumentSync] Stored 45 document metadata from peer
```

### Database Verification
```sql
-- Check discovered peers
SELECT * FROM peers;

-- Check peer documents
SELECT * FROM peer_documents;

-- Check mesh config
SELECT * FROM mesh_config WHERE key = 'peer_id';
```

## Migration from Phase 2A

### Old System (UDP Broadcast)
```javascript
// OLD: Simple UDP broadcast
const PeerDiscovery = require('./peerDiscovery');
const discovery = new PeerDiscovery();
discovery.start();
```

### New System (libp2p Mesh)
```javascript
// NEW: Real P2P mesh networking
const { createMeshManager } = require('./mesh/meshManager');
const mesh = createMeshManager(db);
await mesh.start();
```

**Benefits:**
- ✅ Real P2P (not just broadcast)
- ✅ Encrypted connections (Noise)
- ✅ Proper peer management
- ✅ Protocol versioning
- ✅ Extensible for future features

## Future Phases

### Phase 2D: Document Content Sync
- Implement chunk-based document transfer
- Add progress tracking
- Verify content integrity
- Generate embeddings for synced docs

### Phase 2E: Collaborative Features
- Real-time document collaboration
- CRDT for conflict resolution
- Multi-user chat
- Shared workspaces

### Phase 2F: Advanced Networking
- NAT traversal (STUN/TURN)
- WebRTC data channels
- DHT for peer routing
- Relay nodes for connection

## Troubleshooting

### "Mesh network not running"
- Check console for initialization errors
- Verify libp2p dependencies installed
- Check database permissions

### "No peers discovered"
- Ensure devices on same LAN
- Check firewall/antivirus blocking
- Verify mDNS not disabled
- Wait 5-10 seconds for discovery

### "Connection failed"
- Check network connectivity
- Verify TCP ports not blocked
- Look for Noise encryption errors
- Check libp2p version compatibility

### "Metadata not syncing"
- Verify handshake completed
- Check protocol handler logs
- Validate metadata format
- Check database write permissions

## Summary

Phase 2C delivers:
- ✅ Real libp2p-based P2P networking
- ✅ Automatic peer discovery (mDNS)
- ✅ Encrypted channels (Noise protocol)
- ✅ Metadata exchange working
- ✅ Database schema updated
- ✅ UI integration complete
- ✅ Fault tolerance implemented
- ✅ Modular architecture maintained

**The mesh is real. Not simulated.**

Next steps: Implement full document content sync (Phase 2D).
