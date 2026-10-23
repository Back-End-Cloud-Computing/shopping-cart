#!/usr/bin/env bash
# Builds and pushes the cart-service image for linux/amd64 and linux/arm64
# (the team runs both Intel and Apple Silicon machines).
#
# Usage:
#   ./scripts/publish-image.sh 1.1.0              pushes jcliz/shopping-cart:1.1.0 and :latest
#   IMAGE=<user>/shopping-cart ./scripts/publish-image.sh 1.1.0
set -euo pipefail

VERSION="${1:?Usage: ./scripts/publish-image.sh <version>}"
IMAGE="${IMAGE:-jcliz/shopping-cart}"
BUILDER="multiarch"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi

docker buildx build \
  --builder "$BUILDER" \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  --push \
  "$ROOT"

echo
docker buildx imagetools inspect "$IMAGE:$VERSION"
