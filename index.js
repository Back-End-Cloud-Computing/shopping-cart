const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const redis = require('./config/redis');

const app = express();
app.use(express.json());
app.use(cookieParser());

const cartRoutes = require('./routes/cartRoutes');

app.get('/health', async (req, res) => {
    try {
        await redis.ping();
        res.json({ status: 'ok', redis: 'up' });
    } catch (err) {
        res.status(503).json({ status: 'degraded', redis: 'down', error: err.message });
    }
});

app.use('/api/cart', cartRoutes);

const PORT = process.env.PORT || 3003;

async function start() {
    try {
        await redis.getClient();
        console.log('[cart-service] connected to Redis');
    } catch (err) {
        console.error('[cart-service] failed to connect to Redis:', err.message);
        process.exit(1);
    }

    const server = app.listen(PORT, () => console.log(`[cart-service] running on :${PORT}`));

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            server.close(async () => {
                await redis.disconnect();
                process.exit(0);
            });
        });
    }
}

start();

module.exports = app;
