# shopping-cart

Shopping cart service (formerly `cart-service` from `ganjj-api`), extracted into its own repository and **migrated from PostgreSQL to Redis**.

## Why Redis

The cart is hot, short-lived data always read by a single user — the classic use case for an in-memory key-value store. With Redis:

- drop the `cart` + `cart_items` + `product` JOIN: every cart read is **one** `HGETALL`;
- drop the `cart` table (the "get or create" step no longer exists — the key is born on the first `HSET`);
- an abandoned cart expires on its own via TTL, with no cleanup job.

## Data model

One `HASH` key per user:

```
cart:{userId}
  ├── "12" → {"product_id":12,"name":"T-Shirt","price":50,"color":"blue","image_url":null,"quantity":2,"added_at":1737400000000}
  └── "34" → {"product_id":34,...}
```

- **field** = `product_id` (guarantees a unique item per product without needing a `SELECT` before the `INSERT`);
- **value** = JSON snapshot of the item;
- **TTL** = `CART_TTL_SECONDS` (default 7 days) on the whole key, renewed on every write.

Since there is no longer a JOIN with the `product` table, the name/price/color/image are fetched from the **product-service** at the moment the item is added to the cart and stored in the snapshot.

## Structure

```
config/redis.js                 singleton Redis client (reconnection + health ping)
repositories/cartRepository.js  all Redis key manipulation
controllers/cartController.js   business rules (same HTTP contract as before)
routes/cartRoutes.js            /api/cart routes
middleware/authMiddleware.js    JWT validation (cookie or Bearer)
utils/jwt.js                    access token verification
http/productClient.js           calls to product-service
```

## Running

```bash
npm install
cp .env.example .env          # set JWT_SECRET and REDIS_URL
npm run redis:up              # bring up local Redis via docker compose
npm start
```

Or everything in a container: `docker compose up --build`.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3003` | HTTP port |
| `REDIS_URL` | `redis://localhost:6379` | use `rediss://` for a managed Redis with TLS |
| `REDIS_PREFIX` | `cart` | key prefix |
| `CART_TTL_SECONDS` | `604800` | cart expiration (7 days) |
| `JWT_SECRET` | — | **required**; must match the auth-service |
| `PRODUCT_SERVICE_URL` | `http://localhost:3002` | product-service base URL |
| `INTERNAL_SECRET` | — | `x-internal-secret` header for internal routes |

## API

All routes require authentication (cookie `accessToken` or `Authorization: Bearer <token>`).

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/cart` | lists cart items |
| `POST` | `/api/cart/items` | adds an item — body `{ product_id, quantity }` |
| `PUT` | `/api/cart/items/:product_id` | sets the quantity — body `{ quantity }` |
| `DELETE` | `/api/cart/items/:product_id` | removes an item |
| `DELETE` | `/api/cart` | empties the cart |
| `GET` | `/health` | service status + `PING` on Redis (no auth) |

The request/response format is the same as the Postgres version — the front-end doesn't need to change. The one difference: the item's `id` is now the `product_id` itself (the `cart_items` PK no longer exists).

## Inspecting Redis

```bash
docker exec -it shopping-cart-redis redis-cli
> KEYS cart:*
> HGETALL cart:1
> TTL cart:1
```
