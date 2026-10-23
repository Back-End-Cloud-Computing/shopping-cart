const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Tokens are signed with a throwaway key pair; the app is pointed at its
// public half before it loads.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cart-test-')), 'public.pem');
fs.writeFileSync(keyPath, publicKey.export({ type: 'spki', format: 'pem' }));
process.env.JWT_PUBLIC_KEY_PATH = keyPath;

const redis = require('../config/redis');
const cartRepository = require('../repositories/cartRepository');
const productClient = require('../http/productClient');
const promotionClient = require('../http/promotionClient');
const app = require('../index');

function token(claims = {}) {
    return jwt.sign({ sub: 'user-1', typ: 'access', ...claims }, privateKey, {
        algorithm: 'RS256',
        issuer: 'ganjj-authorization',
        expiresIn: '5m',
    });
}

let store;

beforeEach(() => {
    store = new Map();
    redis.ping = async () => 'PONG';
    cartRepository.listItems = async () => [...store.values()];
    cartRepository.findItem = async (userId, productId) => store.get(String(productId)) ?? null;
    cartRepository.saveItem = async (userId, item) => store.set(String(item.product_id), item);
    productClient.getProduct = async (id) => ({ id, name: 'T-Shirt', price: 50, stock: 10 });
    promotionClient.calculateDiscounts = async () => {
        throw new Error('promotion not stubbed');
    };
});

test('GET /health reports Redis up', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', redis: 'up' });
});

test('cart routes reject requests without a token', async () => {
    const res = await request(app).get('/api/cart');
    assert.equal(res.status, 401);
});

test('cart routes reject tokens that are not access tokens', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token({ typ: 'refresh' })}`);
    assert.equal(res.status, 401);
});

test('POST /api/cart/items forwards the token to product and stores the snapshot', async () => {
    const accessToken = token();
    let forwarded;
    productClient.getProduct = async (id, received) => {
        forwarded = received;
        return { id, name: 'T-Shirt', price: '49.90', stock: 5, attributes: { color: 'blue' } };
    };

    const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: 'abc123', quantity: 2 });

    assert.equal(res.status, 201);
    assert.equal(forwarded, accessToken);
    assert.deepEqual(
        { ...store.get('abc123'), added_at: undefined },
        { product_id: 'abc123', name: 'T-Shirt', price: 49.9, color: 'blue', image_url: null, quantity: 2, added_at: undefined },
    );
});

test('POST /api/cart/items rejects quantities above the reported stock', async () => {
    productClient.getProduct = async (id) => ({ id, name: 'T-Shirt', price: 50, stock: 1 });

    const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token()}`)
        .send({ product_id: 'abc123', quantity: 2 });

    assert.equal(res.status, 400);
});

test('POST /api/cart/items returns 404 for an unknown product', async () => {
    productClient.getProduct = async () => {
        throw Object.assign(new Error('not found'), { status: 404 });
    };

    const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token()}`)
        .send({ product_id: 'missing' });

    assert.equal(res.status, 404);
});

test('POST /api/cart/items returns 502 when product has no price', async () => {
    productClient.getProduct = async (id) => ({ id, name: 'T-Shirt' });

    const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token()}`)
        .send({ product_id: 'abc123' });

    assert.equal(res.status, 502);
});

test('GET /api/cart returns the discounted total from promotion', async () => {
    store.set('abc123', { product_id: 'abc123', name: 'T-Shirt', price: 50, quantity: 2, added_at: 1 });
    let sent;
    promotionClient.calculateDiscounts = async (items, coupon) => {
        sent = { items, coupon };
        return {
            subtotal: '100.00',
            promotions_discount: '30.00',
            coupon_discount: '14.00',
            total: '56.00',
            items: [{ product_id: 'abc123', discount_percentage: 30, discounted_price: '35.00' }],
            coupon: { code: 'INVERNO20', applied: true },
        };
    };

    const res = await request(app).get('/api/cart?coupon=INVERNO20').set('Authorization', `Bearer ${token()}`);

    assert.equal(res.status, 200);
    assert.equal(sent.coupon, 'INVERNO20');
    assert.equal(res.body.total, 56);
    assert.equal(res.body.promotions_discount, 30);
    assert.equal(res.body.coupon_discount, 14);
    assert.equal(res.body.discounts_applied, true);
    assert.equal(res.body.items[0].discounted_price, 35);
    assert.equal(res.body.items[0].discount_percentage, 30);
});

test('GET /api/cart falls back to undiscounted totals when promotion is down', async () => {
    store.set('abc123', { product_id: 'abc123', name: 'T-Shirt', price: 50, quantity: 2, added_at: 1 });

    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token()}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.subtotal, 100);
    assert.equal(res.body.total, 100);
    assert.equal(res.body.discounts_applied, false);
});

test('GET /metrics exposes request metrics by route template', async () => {
    await request(app).get('/api/cart').set('Authorization', `Bearer ${token()}`);

    const res = await request(app).get('/metrics');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);
    assert.match(res.text, /http_request_duration_seconds_count\{[^}]*route="\/api\/cart\/"/);
    assert.match(res.text, /process_cpu_user_seconds_total/);
});
