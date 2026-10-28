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
