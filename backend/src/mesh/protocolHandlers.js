const { prepareDocumentMetadata, storePeerDocuments } = require('./documentSync');

const PROTOCOL_HANDSHAKE = '/cortex/handshake/1.0.0';
const PROTOCOL_METADATA = '/cortex/metadata/1.0.0';
const PROTOCOL_REQUEST = '/cortex/request/1.0.0';

let deps = null;

async function getDeps() {
    if (deps) return deps;

    const [pipeMod, toStringMod, fromStringMod] = await Promise.all([
        import('it-pipe'),
        import('uint8arrays/to-string'),
        import('uint8arrays/from-string'),
    ]);

    deps = {
        pipe: pipeMod.pipe,
        toString: toStringMod.toString,
        fromString: fromStringMod.fromString,
    };

    return deps;
}

async function readAllChunks(stream) {
    const { pipe } = await getDeps();
    const chunks = [];
    let totalSize = 0;
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB limit

    await pipe(
        stream,
        async function (source) {
            for await (const chunk of source) {
                totalSize += chunk.byteLength || chunk.length;
                if (totalSize > MAX_SIZE) {
                    throw new Error('Payload too large: exceeded 2MB limit');
                }
                chunks.push(chunk.subarray());
            }
        }
    );

    return chunks;
}

function setupProtocolHandlers(libp2pNode, db, nodeInfo) {
    libp2pNode.handle(PROTOCOL_HANDSHAKE, async ({ stream, connection }) => {
        try {
            const { fromString, toString, pipe } = await getDeps();
            const remotePeerId = connection.remotePeer.toString();
            const chunks = await readAllChunks(stream);

            if (chunks.length > 0) {
                const message = toString(chunks[0], 'utf8');
                const theirInfo = JSON.parse(message);

                db.upsertPeer(remotePeerId, theirInfo.deviceName || 'Unknown Device', Date.now());

                const ourInfo = {
                    peerId: nodeInfo.peerId,
                    deviceName: nodeInfo.deviceName,
                    docCount: nodeInfo.docCount || 0,
                    version: '1.0.0',
                };

                await pipe([fromString(JSON.stringify(ourInfo), 'utf8')], stream);
            }

            await stream.close();
        } catch (error) {
            console.error('[Protocol] Handshake error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });

    libp2pNode.handle(PROTOCOL_METADATA, async ({ stream, connection }) => {
        try {
            const { fromString, toString, pipe } = await getDeps();
            const remotePeerId = connection.remotePeer.toString();
            const chunks = await readAllChunks(stream);

            if (chunks.length > 0) {
                const message = toString(chunks[0], 'utf8');
                const data = JSON.parse(message);

                if (data.type === 'request') {
                    const metadata = prepareDocumentMetadata(db);
                    const response = {
                        type: 'response',
                        documents: metadata,
                        timestamp: Date.now(),
                    };

                    await pipe([fromString(JSON.stringify(response), 'utf8')], stream);
                } else if (data.type === 'response') {
                    storePeerDocuments(db, remotePeerId, data.documents || []);
                }
            }

            await stream.close();
        } catch (error) {
            console.error('[Protocol] Metadata exchange error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });

    libp2pNode.handle(PROTOCOL_REQUEST, async ({ stream, connection }) => {
        try {
            const { fromString, pipe } = await getDeps();
            const remotePeerId = connection.remotePeer.toString();
            console.log(`[Protocol] Document request from ${remotePeerId.substring(0, 8)}`);

            await readAllChunks(stream);

            const response = {
                error: 'NOT_IMPLEMENTED',
                message: 'Document content transfer not implemented yet. This feature is planned for a future phase.',
            };

            await pipe([fromString(JSON.stringify(response), 'utf8')], stream);
            await stream.close();
        } catch (error) {
            console.error('[Protocol] Request handler error:', error.message);
            try { await stream.close(); } catch (_) {}
        }
    });
}

async function sendHandshake(libp2pNode, peerId, nodeInfo) {
    try {
        const { fromString, toString, pipe } = await getDeps();
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_HANDSHAKE);

        const handshake = {
            peerId: nodeInfo.peerId,
            deviceName: nodeInfo.deviceName,
            docCount: nodeInfo.docCount || 0,
            version: '1.0.0',
        };

        const response = await pipe(
            [fromString(JSON.stringify(handshake), 'utf8')],
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
            return JSON.parse(toString(response[0], 'utf8'));
        }

        return null;
    } catch (error) {
        console.error('[Protocol] Handshake send error:', error.message);
        throw error;
    }
}

async function requestMetadata(libp2pNode, peerId) {
    try {
        const { fromString, toString, pipe } = await getDeps();
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_METADATA);

        const request = {
            type: 'request',
            timestamp: Date.now(),
        };

        const response = await pipe(
            [fromString(JSON.stringify(request), 'utf8')],
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
            const data = JSON.parse(toString(response[0], 'utf8'));
            return data.documents || [];
        }

        return [];
    } catch (error) {
        console.error('[Protocol] Metadata request error:', error.message);
        return [];
    }
}

async function requestDocumentContent(libp2pNode, peerId, docId) {
    try {
        const { fromString, toString, pipe } = await getDeps();
        const stream = await libp2pNode.dialProtocol(peerId, PROTOCOL_REQUEST);

        const request = {
            type: 'document',
            docId,
            timestamp: Date.now(),
        };

        const response = await pipe(
            [fromString(JSON.stringify(request), 'utf8')],
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
            const data = JSON.parse(toString(response[0], 'utf8'));
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
    requestDocumentContent,
};
