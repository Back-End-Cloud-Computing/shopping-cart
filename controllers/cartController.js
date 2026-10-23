const cartRepository = require('../repositories/cartRepository');
const productClient = require('../http/productClient');
const promotionClient = require('../http/promotionClient');

function mapItemResponse(item) {
    return {
        id: item.product_id,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        color: item.color,
        image_url: item.image_url,
        quantity: item.quantity,
    };
}

function toMoney(value) {
    return Math.round(Number(value) * 100) / 100;
}

/**
 * Prices the cart through promotion-service. If promotion is unreachable the
 * cart is still returned, priced without discounts and flagged as such,
 * instead of failing the whole read.
 */
async function buildSummary(items, coupon) {
    const subtotal = toMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const undiscounted = {
        subtotal,
        promotions_discount: 0,
        coupon_discount: 0,
        total: subtotal,
        coupon: null,
        discounts_applied: false,
    };

    if (items.length === 0) return { summary: undiscounted, itemDiscounts: new Map() };

    try {
        const quote = await promotionClient.calculateDiscounts(items, coupon);
        const itemDiscounts = new Map(
            (quote.items || []).map((line) => [String(line.product_id), line]),
        );

        return {
            summary: {
                subtotal: toMoney(quote.subtotal),
                promotions_discount: toMoney(quote.promotions_discount),
                coupon_discount: toMoney(quote.coupon_discount),
                total: toMoney(quote.total),
                coupon: quote.coupon ?? null,
                discounts_applied: true,
            },
            itemDiscounts,
        };
    } catch (err) {
        console.error('Error querying promotion-service:', err);
        return { summary: undiscounted, itemDiscounts: new Map() };
    }
}

async function getCart(req, res) {
    const userId = req.user.sub;
    try {
        const items = await cartRepository.listItems(userId);
        const { summary, itemDiscounts } = await buildSummary(items, req.query.coupon);

        res.json({
            items: items.map((item) => {
                const line = itemDiscounts.get(String(item.product_id));
                return {
                    ...mapItemResponse(item),
                    discount_percentage: line ? Number(line.discount_percentage) : 0,
                    discounted_price: line ? toMoney(line.discounted_price) : item.price,
                };
            }),
            ...summary,
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: 'Error fetching cart' });
    }
}

async function addItem(req, res) {
    const userId = req.user.sub;
    const { product_id, quantity = 1 } = req.body;

    if (!product_id || quantity < 1) {
        return res.status(400).json({ error: 'product_id and quantity are required' });
    }

    let product;
    try {
        product = await productClient.getProduct(product_id, req.accessToken);
    } catch (err) {
        if (err.status === 404) return res.status(404).json({ error: 'Product not found' });
        console.error('Error querying product-service:', err);
        return res.status(502).json({ error: 'Error querying product-service' });
    }

    const price = Number(product.price);
    if (product.price == null || Number.isNaN(price)) {
        return res.status(502).json({ error: 'Product has no price' });
    }

    try {
        const existing = await cartRepository.findItem(userId, product_id);
        const finalQuantity = (existing?.quantity || 0) + quantity;

        // Stock is only enforced when product-service reports it.
        if (typeof product.stock === 'number' && product.stock < finalQuantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        await cartRepository.saveItem(userId, {
            product_id: String(product.id ?? product_id),
            name: product.name,
            price,
            color: product.attributes?.color ?? product.attributes?.cor ?? null,
            image_url: product.image_url ?? null,
            quantity: finalQuantity,
            added_at: existing?.added_at ?? Date.now(),
        });

        res.status(201).json({ message: 'Item added to cart' });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ error: 'Error adding item to cart' });
    }
}

async function updateItem(req, res) {
    const userId = req.user.sub;
    const { product_id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }

    try {
        if (!(await cartRepository.exists(userId))) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        const item = await cartRepository.findItem(userId, product_id);
        if (!item) return res.status(404).json({ error: 'Item not found in cart' });

        await cartRepository.saveItem(userId, { ...item, quantity });
        res.json({ message: 'Quantity updated' });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Error updating cart item' });
    }
}

async function removeItem(req, res) {
    const userId = req.user.sub;
    const { product_id } = req.params;

    try {
        if (!(await cartRepository.exists(userId))) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        const removed = await cartRepository.removeItem(userId, product_id);
        if (!removed) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error removing item:', error);
        res.status(500).json({ error: 'Error removing item from cart' });
    }
}

async function clearCart(req, res) {
    const userId = req.user.sub;
    try {
        if (!(await cartRepository.exists(userId))) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        await cartRepository.clear(userId);
        res.status(204).send();
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ error: 'Error clearing cart' });
    }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
