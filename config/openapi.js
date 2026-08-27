const openapiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Shopping Cart Service API',
        version: '1.0.0',
        description: 'Cart microservice backed by Redis. All /api/cart routes require authentication.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
        },
        schemas: {
            CartItem: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 12 },
                    product_id: { type: 'integer', example: 12 },
                    name: { type: 'string', example: 'T-Shirt' },
                    price: { type: 'number', example: 50 },
                    color: { type: 'string', nullable: true, example: 'blue' },
                    image_url: { type: 'string', nullable: true },
                    quantity: { type: 'integer', example: 2 },
                },
            },
            AddItemRequest: {
                type: 'object',
                required: ['product_id'],
                properties: {
                    product_id: { type: 'integer', example: 12 },
                    quantity: { type: 'integer', example: 1, default: 1 },
                },
            },
            UpdateItemRequest: {
                type: 'object',
                required: ['quantity'],
                properties: {
                    quantity: { type: 'integer', example: 3 },
                },
            },
            Error: {
                type: 'object',
                properties: { error: { type: 'string' } },
            },
        },
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    paths: {
        '/health': {
            get: {
                summary: 'Service health check',
                security: [],
                responses: {
                    200: { description: 'Service and Redis are up' },
                    503: { description: 'Redis is unreachable' },
                },
            },
        },
        '/api/cart': {
            get: {
                summary: 'List the authenticated user\'s cart items',
                responses: {
                    200: {
                        description: 'Cart items',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Missing or invalid token' },
                },
            },
            delete: {
                summary: 'Empty the cart',
                responses: {
                    204: { description: 'Cart emptied' },
                    404: { description: 'Cart not found' },
                },
            },
        },
        '/api/cart/items': {
            post: {
                summary: 'Add an item to the cart',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/AddItemRequest' } } },
                },
                responses: {
                    201: { description: 'Item added' },
                    400: { description: 'Invalid payload or insufficient stock', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Product not found' },
                },
            },
        },
        '/api/cart/items/{product_id}': {
            put: {
                summary: 'Set the quantity of an item in the cart',
                parameters: [{ name: 'product_id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateItemRequest' } } },
                },
                responses: {
                    200: { description: 'Quantity updated' },
                    404: { description: 'Cart or item not found' },
                },
            },
            delete: {
                summary: 'Remove an item from the cart',
                parameters: [{ name: 'product_id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    204: { description: 'Item removed' },
                    404: { description: 'Cart or item not found' },
                },
            },
        },
    },
};

module.exports = openapiSpec;
