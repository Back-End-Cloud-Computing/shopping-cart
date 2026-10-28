# Helm chart — `shopping-cart`

Same layout as [`k8s/`](../../k8s/README.md): the cart-service Deployment and Service, the Ingress allow list
(`/api/cart`, `/docs`, `/openapi.json`, `/health`) and a single-instance Redis. Everything that changes between
environments lives in [`values.yaml`](values.yaml).

Nothing sensitive is in the chart. The Secret `shopping-cart-secrets` (`internal-secret`) and the ConfigMap
`jwt-public-key` (`public.pem`, authorization's public key) are still created by the scripts in `k8s/`:

```bash
./k8s/create-secret.sh
./k8s/create-configmap.sh ../authorization
helm lint helm/shopping-cart
helm upgrade --install shopping-cart helm/shopping-cart
kubectl get pods -w
helm uninstall shopping-cart
```

Common overrides:

| I want | I run |
|---|---|
| Another image version | `--set image.tag=1.1.0` |
| More or fewer replicas | `--set replicaCount=2` |
| Another Ingress host | `--set ingress.host=cart.example.local` |
| A managed Redis | `--set redis.enabled=false --set config.REDIS_URL=rediss://<host>:6380` |
| No Ingress | `--set ingress.enabled=false` |
| Another Secret name | `--set existingSecret=<name>` |

Tested on 2026-10-28 on a clean Minikube (v1.39.0, Kubernetes v1.37.0, Docker driver, `ingress` addon) with Helm
v4.3.1: `helm lint` clean, and `helm install` with the default `values.yaml` brings up 3 cart Pods and Redis, all
`1/1` with no restarts, pulling `jcliz/shopping-cart:1.1.0` from Docker Hub. Through the Ingress, `/health`,
`/docs/` and `/openapi.json` answer 200, `/api/cart` answers 401 without a token or with a forged one and 200 with an
access token signed by the key in `jwt-public-key`, and `/metrics` answers 404; on the Service itself `/metrics`
answers 200, which is the path Prometheus scrapes. `helm upgrade --set replicaCount=2` rolls out to 2/2 and
`helm uninstall` removes every object the chart created, leaving the Secret and the ConfigMap in place.
