const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ service: 'shopping-cart' });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
});

/**
 * Records every request under its route template (/api/cart/items/:product_id),
 * never the raw URL, so product ids don't blow up the label cardinality.
 */
function httpMetrics(req, res, next) {
    if (req.path === '/metrics') return next();

    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
        end({ method: req.method, route, status_code: res.statusCode });
    });
    next();
}

async function metricsHandler(req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}

module.exports = { register, httpMetrics, metricsHandler };
