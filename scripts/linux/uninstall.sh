#!/usr/bin/env bash
# ============================================================
# IQV Dictionary — Linux UNINSTALL.
#
#   ./scripts/linux/uninstall.sh                          # stop/remove services & containers only
#   ./scripts/linux/uninstall.sh --purge                  # + node_modules/dist/images/.env/install state
#   ./scripts/linux/uninstall.sh --purge --remove-source   # + the entire repository (asks for confirmation)
#   ./scripts/linux/uninstall.sh --purge-data              # documents that no DB is touched (see below)
#
# MongoDB is never containerized or managed by this installer (see
# docker-compose.prod.yml) — no uninstall path here ever deletes
# database data. --purge-data exists to satisfy that expectation
# explicitly and is a safe no-op beyond printing what was (not) done.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

PURGE=0
PURGE_DATA=0
REMOVE_SOURCE=0
ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --purge) PURGE=1; shift ;;
    --purge-data) PURGE_DATA=1; shift ;;
    --remove-source) REMOVE_SOURCE=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--purge] [--purge-data] [--remove-source] [--yes]"
      exit 0
      ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

cd "$IQV_REPO_ROOT"

echo "============================================================"
echo " IQV Dictionary — Uninstall"
echo "============================================================"

MODE="$(iqv_installed_mode || true)"
if [ -z "${MODE:-}" ]; then
  log_warn "Could not detect an existing IQV Dictionary installation (no state file, no running containers/PM2 processes)."
  log_warn "Proceeding with best-effort cleanup of both Docker and native artifacts."
  MODE="both"
fi
log_info "Detected installation mode: $MODE"

if [ "$MODE" = "docker" ] || [ "$MODE" = "both" ]; then
  if has_cmd docker && docker compose version >/dev/null 2>&1; then
    log_info "Stopping and removing containers (docker compose down)..."
    docker compose -f "$IQV_COMPOSE_PROD" down --remove-orphans 2>/dev/null || log_warn "docker compose down reported an issue (containers may already be gone)."
    log_ok "Docker containers stopped/removed."

    if [ "$PURGE" -eq 1 ]; then
      log_info "Removing IQV Dictionary production images (--purge)..."
      docker rmi iqv-dictionary-backend:prod iqv-dictionary-frontend:prod >/dev/null 2>&1 || log_warn "One or more images were already removed."
      log_ok "Docker images removed."
    fi
  else
    log_warn "Docker not available on this machine — skipping container cleanup."
  fi
fi

if [ "$MODE" = "native" ] || [ "$MODE" = "both" ]; then
  if PM2_BIN="$(pm2_bin)"; then
    log_info "Stopping and removing PM2 processes..."
    "$PM2_BIN" delete iqv-dictionary-backend iqv-dictionary-frontend >/dev/null 2>&1 || log_warn "PM2 processes were already stopped/removed."
    "$PM2_BIN" save --force >/dev/null 2>&1 || true
    log_ok "PM2 processes removed."

    log_info "Attempting to de-register PM2 from systemd startup..."
    if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
      UNSTARTUP_CMD="$("$PM2_BIN" unstartup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null | grep '^sudo ' || true)"
      if [ -n "$UNSTARTUP_CMD" ]; then
        eval "$UNSTARTUP_CMD" || log_warn "pm2 unstartup did not complete cleanly (non-fatal)."
      fi
    else
      log_warn "No passwordless sudo — run '$PM2_BIN unstartup systemd' manually if you no longer want IQV Dictionary to start on boot."
    fi
  else
    log_warn "PM2 not found — skipping native service cleanup."
  fi
fi

rm -f "$IQV_STATE_FILE"

if [ "$PURGE_DATA" -eq 1 ]; then
  log_info "--purge-data requested: IQV Dictionary does not manage a MongoDB container or volume (see docker-compose.prod.yml) — your MongoDB data was NOT touched by this uninstall."
fi

if [ "$PURGE" -eq 1 ]; then
  log_info "Purging generated build artifacts and env files..."
  rm -rf "$IQV_REPO_ROOT/backend/node_modules" "$IQV_REPO_ROOT/backend/dist"
  rm -rf "$IQV_REPO_ROOT/dashboard/node_modules" "$IQV_REPO_ROOT/dashboard/dist"
  rm -f "$IQV_REPO_ROOT/backend/.env" "$IQV_REPO_ROOT/dashboard/.env" "$IQV_REPO_ROOT/.env"
  rm -rf "$IQV_STATE_DIR"
  log_ok "Build artifacts, generated .env files, and install state removed."

  if [ "$REMOVE_SOURCE" -eq 1 ]; then
    if [ "$ASSUME_YES" -ne 1 ]; then
      read -r -p "This will permanently delete the ENTIRE repository at '$IQV_REPO_ROOT'. Type 'yes' to confirm: " CONFIRM
      [ "$CONFIRM" = "yes" ] || fail "Aborted — repository was NOT deleted."
    fi
    log_warn "Scheduling repository removal (cannot delete this running script's own directory synchronously)..."
    CLEANUP_SCRIPT="$(mktemp /tmp/iqv-dictionary-cleanup.XXXXXX.sh)"
    cat > "$CLEANUP_SCRIPT" <<CLEANEOF
#!/usr/bin/env bash
sleep 2
rm -rf "$IQV_REPO_ROOT"
rm -f "$CLEANUP_SCRIPT"
CLEANEOF
    chmod +x "$CLEANUP_SCRIPT"
    nohup setsid "$CLEANUP_SCRIPT" >/dev/null 2>&1 < /dev/null &
    disown || true
    echo "============================================================"
    echo "[OK] IQV Dictionary services removed. Repository deletion has"
    echo "     been scheduled and will complete in the background."
    echo "============================================================"
    exit 0
  fi
fi

echo "============================================================"
echo "[OK] IQV Dictionary uninstalled successfully."
if [ "$PURGE" -eq 1 ]; then
  echo "     Build artifacts and generated .env files were purged."
else
  echo "     Source code, node_modules, dist, and .env files were left"
  echo "     in place (pass --purge to remove them too)."
fi
echo "============================================================"
