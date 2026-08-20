const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cartController');

router.use(authenticate);

router.get('/',                    getCart);
router.post('/items',              addItem);
router.put('/items/:product_id',   updateItem);
router.delete('/items/:product_id', removeItem);
router.delete('/',                 clearCart);

module.exports = router;
