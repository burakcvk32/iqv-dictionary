#!/usr/bin/env bash
# ============================================================
# IQV Dictionary — Linux INSTALL.
#
# Single command brings up the whole system (backend + dashboard):
#   ./scripts/linux/install.sh                 # auto-detect Docker
#   ./scripts/linux/install.sh --mode docker    # force Docker
#   ./scripts/linux/install.sh --mode native    # force Node/PM2, no Docker
#
# Idempotent: safe to run again (existing .env files, containers, and
# PM2 processes are reused/updated in place, never blindly recreated).
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

MODE="auto"
while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--mode auto|docker|native]"
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

case "$MODE" in
  auto|docker|native) ;;
  *) fail "Invalid --mode '$MODE' (expected auto, docker, or native)" ;;
esac

cd "$IQV_REPO_ROOT"

echo "============================================================"
echo " IQV Dictionary — Install"
echo " Version: $(iqv_version)"
echo " Path:    $IQV_REPO_ROOT"
echo "============================================================"

# ---- prerequisite: Node.js (needed to read state/generate secrets even
# in Docker mode, and required outright in native mode) ----
has_cmd node || fail "Node.js was not found on PATH. Install Node.js 20+ and re-run."
log_info "Node.js detected: $(node --version)"

# ---- mode resolution ----
if [ "$MODE" = "auto" ]; then
  if docker_available; then
    log_info "Docker detected."
    log_info "Installation mode: docker"
    MODE="docker"
  else
    log_info "Docker not detected."
    log_info "Installation mode: native"
    MODE="native"
  fi
else
  log_info "Installation mode (forced): $MODE"
  if [ "$MODE" = "docker" ] && ! docker_available; then
    fail "Docker/Docker Compose not available, but --mode docker was requested."
  fi
fi

iqv_ensure_backend_env
iqv_ensure_dashboard_env

if [ "$MODE" = "docker" ]; then
  iqv_ensure_root_env
  iqv_load_root_env

  log_info "Building production images (backend + dashboard)..."
  docker compose -f "$IQV_COMPOSE_PROD" --env-file "$IQV_REPO_ROOT/.env" build

  log_info "Starting containers..."
  docker compose -f "$IQV_COMPOSE_PROD" --env-file "$IQV_REPO_ROOT/.env" up -d

  log_info "Waiting for containers to report healthy..."
  ok=1
  iqv_wait_http_ok "http://127.0.0.1:${IQV_BACKEND_PORT}/health" "Backend" 40 3 || ok=0
  iqv_wait_http_ok "http://127.0.0.1:${IQV_FRONTEND_PORT}/" "Frontend" 40 3 || ok=0
  log_check "Docker ......... OK"

  iqv_state_write "docker" "$IQV_BACKEND_PORT" "$IQV_FRONTEND_PORT"

  if [ "$ok" -ne 1 ]; then
    fail "One or more services failed their healthcheck. Run 'docker compose -f docker-compose.prod.yml logs' to investigate."
  fi
else
  # ---- native prerequisites ----
  has_cmd npm || fail "npm was not found on PATH (should ship with Node.js). Install Node.js 20+ and re-run."
  has_cmd corepack || fail "corepack was not found on PATH (should ship with Node.js 16.9+). Install Node.js 20+ and re-run."

  log_info "Enabling pnpm via corepack (dashboard's declared package manager)..."
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.15.9 --activate

  if ! PM2_BIN="$(pm2_bin)"; then
    log_info "PM2 not found — installing globally (npm install -g pm2)..."
    npm install -g pm2
    PM2_BIN="$(pm2_bin)" || fail "PM2 installation did not complete successfully."
  fi
  log_info "PM2 detected: $("$PM2_BIN" --version)"

  log_info "Installing backend dependencies (npm ci)..."
  (cd "$IQV_REPO_ROOT/backend" && npm ci)

  log_info "Building backend (tsc)..."
  (cd "$IQV_REPO_ROOT/backend" && npm run build)

  log_info "Installing dashboard dependencies (pnpm install --frozen-lockfile)..."
  (cd "$IQV_REPO_ROOT/dashboard" && pnpm install --frozen-lockfile)

  log_info "Building dashboard (production bundle)..."
  (cd "$IQV_REPO_ROOT/dashboard" && pnpm run build)

  iqv_ensure_root_env
  iqv_load_root_env

  log_info "Starting IQV Dictionary under PM2 (backend + frontend)..."
  "$PM2_BIN" startOrReload "$IQV_ECOSYSTEM" --update-env || "$PM2_BIN" start "$IQV_ECOSYSTEM"
  "$PM2_BIN" save

  log_info "Registering PM2 to resurrect IQV Dictionary on reboot (systemd)..."
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    STARTUP_CMD="$("$PM2_BIN" startup systemd -u "$(whoami)" --hp "$HOME" | grep '^sudo ' || true)"
    if [ -n "$STARTUP_CMD" ]; then
      if eval "$STARTUP_CMD"; then
        log_ok "PM2 systemd startup registered."
      else
        log_warn "Automatic 'pm2 startup' registration failed (non-fatal). Run '$PM2_BIN startup' manually to survive reboots."
      fi
    else
      log_warn "Could not determine the 'pm2 startup' command automatically. Run '$PM2_BIN startup' manually and follow its instructions to survive reboots."
    fi
  else
    log_warn "No passwordless sudo available — skipping automatic boot registration."
    log_warn "Run: $PM2_BIN startup systemd    (then run the sudo command it prints) to make IQV Dictionary survive a reboot."
  fi

  log_info "Waiting for services to become healthy..."
  ok=1
  iqv_wait_http_ok "http://127.0.0.1:${IQV_BACKEND_PORT}/health" "Backend" 30 2 || ok=0
  iqv_wait_http_ok "http://127.0.0.1:${IQV_FRONTEND_PORT}/" "Frontend" 30 2 || ok=0

  iqv_state_write "native" "$IQV_BACKEND_PORT" "$IQV_FRONTEND_PORT"

  if [ "$ok" -ne 1 ]; then
    fail "One or more services failed their healthcheck. Run '$PM2_BIN logs' to investigate."
  fi
fi

log_check "Health .......... OK"
echo "============================================================"
echo " IQV Dictionary installation completed successfully."
echo " Backend:  http://localhost:${IQV_BACKEND_PORT}"
echo " Frontend: http://localhost:${IQV_FRONTEND_PORT}"
echo " Mode:     $MODE"
echo "============================================================"
