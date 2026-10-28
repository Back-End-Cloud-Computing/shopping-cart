const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// A promotion that accepts the connection and never answers, which is how the
// call behaves with promotion at 0 pods behind its Service.
const hangingServer = http.createServer(() => {});

after(() => hangingServer.close());

test('calculateDiscounts gives up once PROMOTION_TIMEOUT_MS has passed', async () => {
    await new Promise((resolve) => hangingServer.listen(0, '127.0.0.1', resolve));
    process.env.PROMOTION_SERVICE_URL = `http://127.0.0.1:${hangingServer.address().port}`;
    process.env.PROMOTION_TIMEOUT_MS = '200';
    const { calculateDiscounts } = require('../http/promotionClient');

    const startedAt = Date.now();
    await assert.rejects(
        calculateDiscounts([{ product_id: 'abc123', price: 50, quantity: 1 }]),
        { name: 'TimeoutError' },
    );
    assert.ok(Date.now() - startedAt < 2000);

    hangingServer.closeAllConnections();
});
