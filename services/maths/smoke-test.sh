#!/usr/bin/env bash
# Builds the maths engine image, starts it and checks /health and /check-working answer.
# Usage: services/maths/smoke-test.sh [--no-build]   (used by CI; needs Docker and curl)
set -euo pipefail

IMAGE="revisionden-maths:smoke"
NAME="revisionden-maths-smoke"
PORT="${SMOKE_PORT:-18080}"
cd "$(dirname "$0")"

if [[ "${1:-}" != "--no-build" ]]; then
  docker build -t "$IMAGE" .
fi
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "$PORT:8080" "$IMAGE" >/dev/null
trap 'docker logs "$NAME" || true; docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

health="$(curl -fsS "http://localhost:$PORT/health")"
echo "health: $health"
[[ "$health" == '{"status":"ok"}' ]]

working="$(curl -fsS -X POST "http://localhost:$PORT/check-working" \
  -H 'content-type: application/json' \
  -d '{"lines":["2x + 3 = 7","2x = 7 + 3"]}')"
echo "check-working: $working"
[[ "$working" == *'"first_wrong_line":1'* ]]
echo "Smoke test passed"
