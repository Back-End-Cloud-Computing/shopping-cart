const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// A product that accepts the connection and never answers, which is how the
// call behaves with product at 0 pods behind its Service.
const hangingServer = http.createServer(() => {});

after(() => hangingServer.close());

test('getProduct gives up once PRODUCT_TIMEOUT_MS has passed', async () => {
    await new Promise((resolve) => hangingServer.listen(0, '127.0.0.1', resolve));
    process.env.PRODUCT_SERVICE_URL = `http://127.0.0.1:${hangingServer.address().port}`;
    process.env.PRODUCT_TIMEOUT_MS = '200';
    const { getProduct } = require('../http/productClient');

    const startedAt = Date.now();
    await assert.rejects(getProduct('abc123', 'token'), { name: 'TimeoutError' });
    assert.ok(Date.now() - startedAt < 2000);

    hangingServer.closeAllConnections();
});
