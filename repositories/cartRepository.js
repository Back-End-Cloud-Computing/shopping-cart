const redis = require('../config/redis');

const PREFIX = process.env.REDIS_PREFIX || 'cart';
const TTL_SECONDS = Number(process.env.CART_TTL_SECONDS) || 60 * 60 * 24 * 7;

function cartKey(userId) {
    return `${PREFIX}:${userId}`;
}

async function renewTtl(conn, key) {
    await conn.expire(key, TTL_SECONDS);
}

async function listItems(userId) {
    const conn = await redis.getClient();
    const hash = await conn.hGetAll(cartKey(userId));

    return Object.values(hash)
        .map((raw) => JSON.parse(raw))
        .sort((a, b) => a.added_at - b.added_at);
}

async function findItem(userId, productId) {
    const conn = await redis.getClient();
    const raw = await conn.hGet(cartKey(userId), String(productId));
    return raw ? JSON.parse(raw) : null;
}

async function saveItem(userId, item) {
    const conn = await redis.getClient();
    const key = cartKey(userId);
    await conn.hSet(key, String(item.product_id), JSON.stringify(item));
    await renewTtl(conn, key);
    return item;
}

async function removeItem(userId, productId) {
    const conn = await redis.getClient();
    const key = cartKey(userId);
    const removed = await conn.hDel(key, String(productId));
    if (removed > 0) await renewTtl(conn, key);
    return removed > 0;
}

async function clear(userId) {
    const conn = await redis.getClient();
    const removed = await conn.del(cartKey(userId));
    return removed > 0;
}

async function exists(userId) {
    const conn = await redis.getClient();
    const total = await conn.exists(cartKey(userId));
    return total > 0;
}

module.exports = {
    cartKey,
    listItems,
    findItem,
    saveItem,
    removeItem,
    clear,
    exists,
    TTL_SECONDS,
};
