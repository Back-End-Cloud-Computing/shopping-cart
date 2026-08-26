const cartRepository = require('../repositories/cartRepository');
const productClient = require('../http/productClient');

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

async function getCart(req, res) {
    const userId = req.user.id;
    try {
        const items = await cartRepository.listItems(userId);
        res.json({ items: items.map(mapItemResponse) });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: 'Error fetching cart' });
    }
}

async function addItem(req, res) {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    if (!product_id || quantity < 1) {
        return res.status(400).json({ error: 'product_id and quantity are required' });
    }

    let product;
    try {
        product = await productClient.getProduct(product_id);
    } catch (err) {
        if (err.status === 404) return res.status(404).json({ error: 'Product not found' });
        console.error('Error querying product-service:', err);
        return res.status(500).json({ error: 'Error checking stock' });
    }

    try {
        const existing = await cartRepository.findItem(userId, product_id);
        const finalQuantity = (existing?.quantity || 0) + quantity;

        if (product.stock < finalQuantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        await cartRepository.saveItem(userId, {
            product_id: product.id ?? product_id,
            name: product.name,
            price: Number(product.price),
            color: product.color ?? null,
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
    const userId = req.user.id;
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
    const userId = req.user.id;
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
    const userId = req.user.id;
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
