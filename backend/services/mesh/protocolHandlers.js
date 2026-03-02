const { pipe } = require('it-pipe');
const { toString: uint8ArrayToString } = require('uint8arrays/to-string');
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string');
const { prepareDocumentMetadata, storePeerDocuments, validateDocumentMetadata } = require('./documentSync');

/**
 * Protocol Handlers for Cortex Mesh Network
 * 
 * Defines custom libp2p protocols for:
 * - Handshake and peer information exchange
 * - Document metadata sharing
 * - Future: Document content requests
 * 
 * Protocol IDs:
 * - /cortex/handshake/1.0.0 - Initial connection handshake
 * - /cortex/metadata/1.0.0 - Document metadata exchange
 * - /cortex/request/1.0.0 - Document content requests (stub)
 */

// Protocol identifiers
const PROTOCOL_HANDSHAKE = '/cortex/handshake/1.0.0';
const PROTOCOL_METADATA = '/cortex/metadata/1.0.0';
const PROTOCOL_REQUEST = '/cortex/request/1.0.0';

/**
 * Setup protocol handlers for a libp2p node
 * 
 * @param {Object} libp2pNode - libp2p instance
 * @param {Object} db - Database instance
 * @param {Object} nodeInfo - Node information (peerId, deviceName, etc)
 */
function setupProtocolHandlers(libp2pNode, db, nodeInfo) {
    // Handshake protocol - exchange basic peer info
    libp2pNode.handle(PROTOCOL_HANDSHAKE, async ({ stream, connection }) => {
        try {
            const remotePeerId = connection.remotePeer.toString();
            console.log(`[Protocol] Handshake initiated by ${remotePeerId.substring(0, 8)}`);
            
            // Read their handshake
            const chunks = [];
            await pipe(
                stream,
                async function (source) {
                    for await (const chunk of source) {
                        chunks.push(chunk.subarray());
                    }
                }
            );
            
            if (chunks.length > 0) {
                const message = uint8ArrayToString(chunks[0], 'utf8');
                const theirInfo = JSON.parse(message);
                
                console.log(`[Protocol] Received handshake from ${theirInfo.deviceName}`);
                
                // Store peer info in database
                db.upsertPeer(
                    remotePeerId,
                    theirInfo.deviceName || 'Unknown Device',
                    Date.now()
                );
                
                // Send our handshake response
                const ourInfo = {
                    peerId: nodeInfo.peerId,
                    deviceName: nodeInfo.deviceName,
                    docCount: nodeInfo.docCount || 0,
                    version: '1.0.0'
                };
                
                const response = uint8ArrayFromString(JSON.stringify(ourInfo), 'utf8');
                await pipe(
                    [response],
                    stream
                );
            }
            
            await stream.close();
        } catch (error) {
            console.error('[Protocol] Handshake error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });
    
    // Metadata exchange protocol
    libp2pNode.handle(PROTOCOL_METADATA, async ({ stream, connection }) => {
        try {
            const remotePeerId = connection.remotePeer.toString();
            console.log(`[Protocol] Metadata exchange initiated by ${remotePeerId.substring(0, 8)}`);
            
            // Read their metadata request/response
            const chunks = [];
            await pipe(
                stream,
                async function (source) {
                    for await (const chunk of source) {
                        chunks.push(chunk.subarray());
                    }
                }
            );
            
            if (chunks.length > 0) {
                const message = uint8ArrayToString(chunks[0], 'utf8');
                const data = JSON.parse(message);
                
                if (data.type === 'request') {
                    // They're requesting our metadata
                    console.log(`[Protocol] Sending metadata to ${remotePeerId.substring(0, 8)}`);
                    
                    const metadata = prepareDocumentMetadata(db);
                    const response = {
                        type: 'response',
                        documents: metadata,
                        timestamp: Date.now()
                    };
                    
                    const responseData = uint8ArrayFromString(JSON.stringify(response), 'utf8');
                    await pipe([responseData], stream);
                    
                } else if (data.type === 'response') {
                    // They're sending us their metadata
                    console.log(`[Protocol] Received metadata from ${remotePeerId.substring(0, 8)}: ${data.documents.length} documents`);
                    
                    const stored = storePeerDocuments(db, remotePeerId, data.documents);
                    console.log(`[Protocol] Stored ${stored} document metadata`);
                }
            }
            
            await stream.close();
        } catch (error) {
            console.error('[Protocol] Metadata exchange error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });
    
    // Document request protocol (stub)
    libp2pNode.handle(PROTOCOL_REQUEST, async ({ stream, connection }) => {
        try {
            const remotePeerId = connection.remotePeer.toString();
            console.log(`[Protocol] Document request from ${remotePeerId.substring(0, 8)}`);
            
            // Read their request
            const chunks = [];
            await pipe(
                stream,
                async function (source) {
                    for await (const chunk of source) {
                        chunks.push(chunk.subarray());
                    }
                }
            );
            
            // Send "not implemented" response
            const response = {
                error: 'NOT_IMPLEMENTED',
                message: 'Document content transfer not implemented yet. This feature is planned for a future phase.'
            };
            
            const responseData = uint8ArrayFromString(JSON.stringify(response), 'utf8');
            await pipe([responseData], stream);
            await stream.close();
            
            console.log(`[Protocol] Sent NOT_IMPLEMENTED response`);
        } catch (error) {
            console.error('[Protocol] Request handler error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });
    
    console.log('[Protocol] All handlers registered');
}

/**
 * Send handshake to a peer
 * 
 * @param {Object} libp2pNode - libp2p instance
 * @param {string} peerId - Target peer ID
 * @param {Object} nodeInfo - Our node information
 * @returns {Promise<Object>} Peer's handshake response
 */
async function sendHandshake(libp2pNode, peerId, nodeInfo) {
    try {
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_HANDSHAKE);
        
        const handshake = {
            peerId: nodeInfo.peerId,
            deviceName: nodeInfo.deviceName,
            docCount: nodeInfo.docCount || 0,
            version: '1.0.0'
        };
        
        const data = uint8ArrayFromString(JSON.stringify(handshake), 'utf8');
        
        // Send and receive
        const response = await pipe(
            [data],
            stream,
            async function (source) {
                const chunks = [];
                for await (const chunk of source) {
                    chunks.push(chunk.subarray());
                }
                return chunks;
            }
        );
        
        await stream.close();
        
        if (response.length > 0) {
            const responseText = uint8ArrayToString(response[0], 'utf8');
            return JSON.parse(responseText);
        }
        
        return null;
    } catch (error) {
        console.error('[Protocol] Handshake send error:', error.message);
        throw error;
    }
}

/**
 * Request metadata from a peer
 * 
 * @param {Object} libp2pNode - libp2p instance
 * @param {string} peerId - Target peer ID
 * @returns {Promise<Array>} Array of document metadata
 */
async function requestMetadata(libp2pNode, peerId) {
    try {
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_METADATA);
        
        const request = {
            type: 'request',
            timestamp: Date.now()
        };
        
        const data = uint8ArrayFromString(JSON.stringify(request), 'utf8');
        
        // Send request and receive response
        const response = await pipe(
            [data],
            stream,
            async function (source) {
                const chunks = [];
                for await (const chunk of source) {
                    chunks.push(chunk.subarray());
                }
                return chunks;
            }
        );
        
        await stream.close();
        
        if (response.length > 0) {
            const responseText = uint8ArrayToString(response[0], 'utf8');
            const data = JSON.parse(responseText);
            return data.documents || [];
        }
        
        return [];
    } catch (error) {
        console.error('[Protocol] Metadata request error:', error.message);
        return [];
    }
}

/**
 * Request document content from peer (stub - not implemented)
 * 
 * @param {Object} libp2pNode - libp2p instance
 * @param {string} peerId - Target peer ID
 * @param {string} docId - Document ID to request
 * @returns {Promise<Object>} Document data (throws error)
 */
async function requestDocumentContent(libp2pNode, peerId, docId) {
    try {
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_REQUEST);
        
        const request = {
            type: 'document',
            docId: docId,
            timestamp: Date.now()
        };
        
        const data = uint8ArrayFromString(JSON.stringify(request), 'utf8');
        
        const response = await pipe(
            [data],
            stream,
            async function (source) {
                const chunks = [];
                for await (const chunk of source) {
                    chunks.push(chunk.subarray());
                }
                return chunks;
            }
        );
        
        await stream.close();
        
        if (response.length > 0) {
            const responseText = uint8ArrayToString(response[0], 'utf8');
            const data = JSON.parse(responseText);
            
            if (data.error === 'NOT_IMPLEMENTED') {
                throw new Error(data.message);
            }
            
            return data;
        }
        
        throw new Error('No response received');
    } catch (error) {
        console.error('[Protocol] Document request error:', error.message);
        throw error;
    }
}

module.exports = {
    PROTOCOL_HANDSHAKE,
    PROTOCOL_METADATA,
    PROTOCOL_REQUEST,
    setupProtocolHandlers,
    sendHandshake,
    requestMetadata,
    requestDocumentContent
};
