#!/usr/bin/env bash
# Creates the ConfigMap with authorization's PUBLIC key.
#
# ConfigMap and not Secret on purpose: this key only verifies tokens, it can
# never issue them. The private key stays in authorization alone, in a Secret.
#
# Usage:
#   ./k8s/create-configmap.sh                     uses keys/public.pem
#   ./k8s/create-configmap.sh ../authorization     fetches from the authorization repo
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$ROOT}"
KEY="$SOURCE/keys/public.pem"

if [[ ! -f "$KEY" ]]; then
  echo "Public key not found at $KEY."
  echo "Point this at the authorization repo: ./k8s/create-configmap.sh ../authorization"
  exit 1
fi

kubectl create configmap jwt-public-key \
  --from-file=public.pem="$KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo
echo "ConfigMap 'jwt-public-key' ready. Check it with:"
echo "  kubectl describe configmap jwt-public-key"
