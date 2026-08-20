const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

async function request(path, options = {}) {
    const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, options);

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body.error || 'Error in product-service');
        err.status = response.status;
        throw err;
    }

    return response.json();
}

async function checkStock(productId) {
    return request(`/internal/products/${productId}/stock`, {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
    });
}

async function getProduct(productId) {
    return request(`/api/products/${productId}`);
}

module.exports = { checkStock, getProduct };
