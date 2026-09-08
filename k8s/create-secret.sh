#!/usr/bin/env bash
# Creates the Secret holding INTERNAL_SECRET, the shared header cart-service
# sends product-service on internal calls (stock checks).
#
# Not a versioned YAML on purpose: the value isn't committed to Git. It's read
# from the local .env by default, same value the docker-compose setup uses.
#
# Usage:
#   ./k8s/create-secret.sh                reads INTERNAL_SECRET from ../.env
#   ./k8s/create-secret.sh <value>         uses the value passed directly
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

SECRET="${1:-}"
if [[ -z "$SECRET" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "No .env found at $ENV_FILE and no value given."
    echo "Usage: ./k8s/create-secret.sh <internal-secret-value>"
    exit 1
  fi
  SECRET="$(grep -E '^INTERNAL_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi

if [[ -z "$SECRET" ]]; then
  echo "INTERNAL_SECRET is empty. Set it in .env or pass it as an argument."
  exit 1
fi

kubectl create secret generic shopping-cart-secrets \
  --from-literal=internal-secret="$SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo
echo "Secret 'shopping-cart-secrets' ready. Check it with:"
echo "  kubectl describe secret shopping-cart-secrets"
