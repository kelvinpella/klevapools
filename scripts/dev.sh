#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

REDIS_TARGET=$(node --env-file-if-exists=.env --input-type=module -e '
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  process.stdout.write(`${redisUrl.protocol} ${redisUrl.hostname} ${redisUrl.port || "6379"}`);
')
set -- $REDIS_TARGET
REDIS_PROTOCOL=$1
REDIS_HOST=$2
REDIS_PORT=$3
case "$REDIS_HOST" in
  \[*\]) REDIS_HOST=${REDIS_HOST#\[}; REDIS_HOST=${REDIS_HOST%\]} ;;
esac
REDIS_CLI=${REDIS_CLI:-redis-cli}
REDIS_PID_FILE="${TMPDIR:-/tmp}/naja-redis-${REDIS_PORT}.pid"
REDIS_LOG_FILE="${TMPDIR:-/tmp}/naja-redis-${REDIS_PORT}.log"
STARTED_REDIS=0
APP_PID=
WORKER_PID=

cleanup() {
  trap - EXIT HUP INT TERM

  if [ -n "$APP_PID" ]; then
    kill -TERM "$APP_PID" 2>/dev/null || true
  fi
  if [ -n "$WORKER_PID" ]; then
    kill -TERM "$WORKER_PID" 2>/dev/null || true
  fi
  if [ -n "$APP_PID" ]; then
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [ -n "$WORKER_PID" ]; then
    wait "$WORKER_PID" 2>/dev/null || true
  fi

  if [ "$STARTED_REDIS" -eq 1 ]; then
    "$REDIS_CLI" -h "$REDIS_HOST" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
    rm -f "$REDIS_PID_FILE" "$REDIS_LOG_FILE"
  fi
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "$REDIS_PROTOCOL" = "redis:" ]; then
  case "$REDIS_HOST" in
    localhost|127.0.0.1|::1)
      if ! command -v "$REDIS_CLI" >/dev/null 2>&1; then
        printf '%s\n' "redis-cli is required for local development but was not found." >&2
        exit 1
      fi
      if ! "$REDIS_CLI" -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        if ! command -v redis-server >/dev/null 2>&1; then
          printf '%s\n' "redis-server is required for local development but was not found." >&2
          exit 1
        fi
        redis-server \
          --bind "$REDIS_HOST" \
          --port "$REDIS_PORT" \
          --save "" \
          --appendonly no \
          --dir "${TMPDIR:-/tmp}" \
          --daemonize yes \
          --pidfile "$REDIS_PID_FILE" \
          --logfile "$REDIS_LOG_FILE"
        STARTED_REDIS=1

        attempt=0
        until "$REDIS_CLI" -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; do
          attempt=$((attempt + 1))
          if [ "$attempt" -ge 25 ]; then
            printf '%s\n' "Redis did not become ready; see $REDIS_LOG_FILE." >&2
            exit 1
          fi
          sleep 0.2
        done
      fi
      ;;
  esac
fi

printf '%s\n' "Starting Naja API and BullMQ worker..."
node --env-file-if-exists=.env --import tsx --watch src/worker.ts &
WORKER_PID=$!
node --env-file-if-exists=.env --import tsx --watch src/app.ts &
APP_PID=$!

process_running() {
  state=$(ps -o stat= -p "$1" 2>/dev/null || true)
  case "$state" in
    ""|Z*) return 1 ;;
    *) return 0 ;;
  esac
}

while process_running "$APP_PID" && process_running "$WORKER_PID"; do
  sleep 0.5
done

if ! process_running "$APP_PID"; then
  kill -TERM "$WORKER_PID" 2>/dev/null || true
elif ! process_running "$WORKER_PID"; then
  kill -TERM "$APP_PID" 2>/dev/null || true
fi

set +e
wait "$APP_PID"
APP_EXIT_CODE=$?
wait "$WORKER_PID"
WORKER_EXIT_CODE=$?
set -e

if [ "$APP_EXIT_CODE" -ne 0 ]; then
  exit "$APP_EXIT_CODE"
fi
exit "$WORKER_EXIT_CODE"