const PROMOTION_SERVICE_URL = process.env.PROMOTION_SERVICE_URL || 'http://promotion:8000';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const PROMOTION_TIMEOUT_MS = Number(process.env.PROMOTION_TIMEOUT_MS) || 2000;

/**
 * Discount quote for the cart items. Idempotent on promotion's side: it never
 * consumes a coupon use (that is order's job at checkout), so it is safe to
 * call on every cart read.
 *
 * Bounded by PROMOTION_TIMEOUT_MS: with promotion at 0 pods the connection
 * hangs instead of failing, and without a deadline the cart read would hang
 * with it until the gateway gives up with a 504.
 */
async function calculateDiscounts(items, coupon) {
    const response = await fetch(`${PROMOTION_SERVICE_URL}/internal/discounts/calculate`, {
        method: 'POST',
        signal: AbortSignal.timeout(PROMOTION_TIMEOUT_MS),
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({
            items: items.map((item) => ({
                product_id: String(item.product_id),
                unit_price: item.price,
                quantity: item.quantity,
            })),
            coupon: coupon || null,
        }),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body.message || body.error || 'Error in promotion-service');
        err.status = response.status;
        throw err;
    }

    return response.json();
}

module.exports = { calculateDiscounts };
