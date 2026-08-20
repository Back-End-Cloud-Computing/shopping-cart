const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client;

/**
 * Singleton Redis client. The first call opens the connection; subsequent
 * calls reuse it (the driver already handles pooling/reconnection internally).
 */
async function getClient() {
    if (client) {
        if (!client.isOpen) await client.connect();
        return client;
    }

    client = createClient({
        url: REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        },
    });

    client.on('error', (err) => console.error('[redis] connection error:', err.message));
    client.on('reconnecting', () => console.warn('[redis] reconnecting...'));

    await client.connect();
    return client;
}

async function ping() {
    const conn = await getClient();
    return conn.ping();
}

async function disconnect() {
    if (client?.isOpen) await client.quit();
    client = undefined;
}

module.exports = { getClient, ping, disconnect };
