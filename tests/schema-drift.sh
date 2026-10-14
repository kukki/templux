#!/bin/sh
# Run after the application image has been built. All fault injection stays in a fresh project.
set -eu
TEMPLUX_TEST_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TEMPLUX_SOURCE_IMAGE="${TEMPLUX_PROJECT_NAME:-templux}-api"
TEMPLUX_TEST_PROJECT="templux-schema-check-$$"
TEMPLUX_TEST_OUTPUT=$(mktemp -d)
export TEMPLUX_PROJECT_NAME="$TEMPLUX_TEST_PROJECT"
export TEMPLUX_DB_PASSWORD=templux-scenario-only
export DATABASE_URL=postgresql://templux:templux-scenario-only@database:5432/templux
compose_test() {
  docker compose --project-directory "$TEMPLUX_TEST_ROOT" -f "$TEMPLUX_TEST_ROOT/compose.yaml" -p "$TEMPLUX_TEST_PROJECT" "$@"
}
cleanup() {
  compose_test down --volumes --remove-orphans >&2
  docker image rm "$TEMPLUX_TEST_PROJECT-api" >&2
  rm -rf "$TEMPLUX_TEST_OUTPUT"
}
trap cleanup EXIT
docker image tag "$TEMPLUX_SOURCE_IMAGE" "$TEMPLUX_TEST_PROJECT-api"
compose_test up -d --wait --wait-timeout 60 database
compose_test run --rm --no-deps migrate --json
compose_test exec -T database psql -U templux -d templux -v ON_ERROR_STOP=1 -c 'DROP SCHEMA templux'
if compose_test run --rm --no-deps migrate --check --json > "$TEMPLUX_TEST_OUTPUT/check.json"; then
  echo 'FAIL: a missing application schema was incorrectly accepted as ready.' >&2
  exit 1
fi
echo 'PASS: public migration check rejects missing application structure.'
