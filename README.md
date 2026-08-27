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

Prerequisites: Node.js 20+, Docker Desktop running.

### Option 1 — Redis in a container, service on the host

Best for day-to-day development (fast reload with `npm run dev`).

```bash
npm install
# create a .env file with PORT, REDIS_URL, JWT_SECRET, INTERNAL_SECRET, etc. (see Environment variables below)
npm run redis:up              # starts the redis container (docker-compose.yml)
npm run dev                   # or `npm start`
```

Check it worked:

```bash
curl http://localhost:3003/health
# {"status":"ok","redis":"up"}
```

Stop Redis when done: `npm run redis:down`.

### Option 2 — everything in containers

Builds the service image and starts it together with Redis, connected over the compose network (the service reaches Redis at `redis://redis:6379`, already set in `docker-compose.yml`).

```bash
# create a .env file with PORT, REDIS_URL, JWT_SECRET, INTERNAL_SECRET, etc. (see Environment variables below)
docker compose up --build
```

Add `-d` to run in the background; stop everything with `docker compose down`.

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

## API documentation (Swagger)

With the service running, the interactive docs are available at:

```
http://localhost:3003/docs/
```

The raw OpenAPI spec is served at `http://localhost:3003/openapi.json`.

## Docker Hub image

The service is also published as a versioned image at [`jcliz/shopping-cart`](https://hub.docker.com/r/jcliz/shopping-cart).

Run it directly, without building anything locally:

```bash
docker run -d --name shopping-cart-service -p 3003:3003 \
  --env-file .env \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  jcliz/shopping-cart:1.0.0
```

This still needs a reachable Redis (`npm run redis:up` starts one on `localhost:6379`, exposed to containers as `host.docker.internal:6379`). To publish a new version yourself:

```bash
docker build -t jcliz/shopping-cart:<version> -t jcliz/shopping-cart:latest .
docker login
docker push jcliz/shopping-cart:<version>
docker push jcliz/shopping-cart:latest
```

## Running on Kubernetes (minikube)

Local Kubernetes setup used for the `kubernetes-fundamentos` lab, driven entirely with `kubectl` (no manifests yet — everything below is created imperatively).

### Prerequisites

- Docker Desktop running (minikube uses the `docker` driver).
- `minikube` and `kubectl` installed. On Windows: `winget install -e --id Kubernetes.minikube` (kubectl is usually already available; check with `kubectl version --client`).

### 1. Start the cluster

```bash
minikube start --driver=docker
minikube status
kubectl get nodes
```

The node should show up with status `Ready`.

### 2. Deploy the app and expose it

```bash
kubectl create deployment nginx --image=nginx
kubectl scale deployment nginx --replicas=3
kubectl get deployments
kubectl get pods

kubectl expose deployment nginx --name=nginx-service --port=80
kubectl get services
```

`nginx-service` is a `ClusterIP` Service: it gives the 3 Pods a single stable name and load-balances between them, but it's only reachable from inside the cluster.

### 3. Test the Service from inside the cluster

```bash
kubectl run teste --image=curlimages/curl --restart=Never --attach --rm -- curl -s http://nginx-service
```

This proves DNS-based service discovery works (the client only needs the Service name, never a Pod IP). Note: `-it` doesn't work in a non-interactive terminal (e.g. Claude Code's Bash tool) — use `--attach` and pass the command directly instead of opening an interactive shell.

### 4. Access it from the host browser

A `ClusterIP` Service has no automatic port on `localhost`. Use `port-forward` for a temporary tunnel:

```bash
kubectl port-forward service/nginx-service 8080:80
```

Keep this running in the background, then open `http://localhost:8080`. Stop it with `Ctrl+C` (or kill the `kubectl` process) when done.

### 5. Stop or remove the cluster

```bash
minikube stop     # pauses the cluster, keeps it for next time (preferred between labs)
minikube start    # resumes it
minikube delete   # removes it completely
```

## Inspecting Redis

```bash
docker exec -it shopping-cart-redis redis-cli
> KEYS cart:*
> HGETALL cart:1
> TTL cart:1
```
