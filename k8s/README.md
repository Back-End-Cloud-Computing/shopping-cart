# Shopping Cart on Kubernetes

Declarative manifests for the cart-service: three replicas behind a Service,
backed by a single-instance Redis.

```
Service shopping-cart :3003
        |
 Service Discovery
        |
 +------+------+------+
 |             |      |
Pod           Pod    Pod
 |             |      |
 +------+------+------+
        |
        | redis:6379
        v
 Service redis
        |
     Pod Redis
```

## Bring it up

authorization needs to be in the cluster first, since shopping-cart verifies
tokens with its public key.

```bash
./k8s/create-configmap.sh ../authorization
./k8s/create-secret.sh
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/shopping-cart.yaml
kubectl wait --for=condition=ready pod -l app=shopping-cart --timeout=180s
```

## ConfigMap and Secret, not YAML

`jwt-public-key` is a ConfigMap because it's the **public** key: it verifies
tokens but can't issue them. `shopping-cart-secrets` (`INTERNAL_SECRET`) is a
Secret because it's a real credential — the header cart-service sends
product-service on internal calls. Neither is a tracked manifest: both are
created imperatively by the scripts in this folder so the actual values never
land in Git.

## See the load balancing across replicas

```bash
kubectl run test --image=curlimages/curl:latest -it --rm -- sh
```

```sh
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s http://shopping-cart:3003/health; echo; done
```

Every reply comes from a different Pod depending on which one the Service
routed to, but all of them report the same Redis — there's only one instance,
shared by all three replicas.

## Talking to the other GANJJ services

From inside the cluster, a token issued by authorization is accepted here too:

```sh
T=$(curl -s -X POST http://authorization:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"k8s@ganjj.com","password":"senhaSegura123"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

curl -s -o /dev/null -w "%{http_code}\n" http://shopping-cart:3003/api/cart \
  -H "Authorization: Bearer $T"
```

Neither service needs to know the other's IP: `authorization` and
`shopping-cart` resolve through the cluster's internal DNS.

## Self-healing

```bash
kubectl delete pod <one-of-the-pod-names>
kubectl get pods -l app=shopping-cart
```

The Deployment recreates the Pod to keep the three declared replicas.

## Reaching it from the host

**Via port-forward:**

```bash
kubectl port-forward service/shopping-cart 3003:3003
```

**Via Ingress** — see the equivalent explanation in
`authorization/k8s/README.md`:

```bash
kubectl apply -f k8s/ingress.yaml
kubectl get svc -n ingress-nginx ingress-nginx-controller   # grab EXTERNAL-IP
curl -H "Host: shopping-cart.ganjj.local" http://<EXTERNAL-IP>/health
```

## About the image

Published at [jcliz/shopping-cart](https://hub.docker.com/r/jcliz/shopping-cart).
To publish a new version:

```bash
docker build -t jcliz/shopping-cart:1.1.0 .
docker push jcliz/shopping-cart:1.1.0
```

And update the tag in `image:` inside `shopping-cart.yaml`.

## Known limitation

Redis runs as a Deployment with no persistent volume: if the Pod is recreated,
every cart is lost. A real deployment would want a StatefulSet with a
PersistentVolumeClaim (or a managed Redis) instead.

## Relation to the minikube lab in the main README

The [main README](../README.md#running-on-kubernetes-minikube) walks through
an imperative `kubectl` lab with a plain `nginx` image, just to exercise
Deployments/Services/self-healing on a fresh cluster. The manifests here are
the real next step: the actual cart-service image, wired to Redis and to
authorization's key, applied declaratively instead of typed by hand.
