const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:8000';

async function request(path, options = {}) {
    const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, options);

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body.detail || body.error || 'Error in product-service');
        err.status = response.status;
        throw err;
    }

    return response.json();
}

/**
 * product-service protects every route with the same RS256 access token the
 * cart receives, so the caller's token is forwarded as a Bearer header.
 * Price and stock come in the product body itself (`price`, `stock`).
 */
async function getProduct(productId, accessToken) {
    return request(`/products/${encodeURIComponent(productId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
}

module.exports = { getProduct };
