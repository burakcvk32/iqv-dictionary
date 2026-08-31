#!/usr/bin/env bash
# ============================================================
# IQV Dictionary — Linux UPDATE.
#
#   ./scripts/linux/update.sh
#
# Flow: detect how IQV Dictionary was installed (docker/native) -> git
# fetch + safe (fast-forward-only) pull -> detect what actually changed
# -> reinstall dependencies / rebuild only what needs it -> restart ->
# healthcheck -> report the version transition. Never runs
# `git reset --hard`, `git clean -fd`, or `git checkout .` — a dirty
# working tree aborts the update instead of discarding local changes.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

FORCE_MODE=""
SKIP_GIT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      FORCE_MODE="${2:-}"
      shift 2
      ;;
    --mode=*)
      FORCE_MODE="${1#*=}"
      shift
      ;;
    --skip-git)
      SKIP_GIT=1
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--mode docker|native] [--skip-git]"
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

cd "$IQV_REPO_ROOT"

echo "============================================================"
echo " IQV Dictionary — Update"
echo "============================================================"

# ---- 1/2: environment + installation detection ----
MODE="$FORCE_MODE"
if [ -z "$MODE" ]; then
  if ! MODE="$(iqv_installed_mode)"; then
    fail "Could not detect an existing IQV Dictionary installation. Run scripts/linux/install.sh first, or pass --mode docker|native explicitly."
  fi
fi
log_info "Detected installation mode: $MODE"

CURRENT_VERSION="$(iqv_version)"

# ---- 3/4/5: git repository / branch / fetch / safe pull ----
OLD_SHA=""
NEW_SHA=""
if [ "$SKIP_GIT" -eq 1 ]; then
  log_warn "--skip-git passed — skipping git fetch/pull, only rebuilding/restarting in place."
elif ! iqv_is_git_repo; then
  log_warn "Not a Git repository — skipping fetch/pull, only rebuilding/restarting in place."
else
  if iqv_git_dirty; then
    log_err "Local modifications detected (git status is not clean)."
    log_err "Update aborted to prevent data loss. Commit, stash, or discard your changes yourself, then re-run update."
    exit 1
  fi

  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$BRANCH" = "HEAD" ]; then
    fail "Repository is in a detached HEAD state — checkout a branch before updating."
  fi
  log_info "Current branch: $BRANCH"

  OLD_SHA="$(git rev-parse HEAD)"

  log_info "Fetching origin/$BRANCH..."
  git fetch origin "$BRANCH"

  log_info "Pulling (fast-forward only — never rewrites local history)..."
  if ! git pull --ff-only origin "$BRANCH"; then
    fail "git pull --ff-only failed (local and remote history have diverged). Resolve manually (e.g. rebase/merge) and re-run update."
  fi

  NEW_SHA="$(git rev-parse HEAD)"
fi

NEW_VERSION="$(iqv_version)"
echo "------------------------------------------------------------"
echo " IQV Dictionary"
echo " Current version : $CURRENT_VERSION"
echo " Target version  : $NEW_VERSION"
echo "------------------------------------------------------------"

# ---- ensure env files still exist (upgrading an older install) ----
iqv_ensure_backend_env
iqv_ensure_dashboard_env

# ---- 13: detect which changed files require which action ----
CHANGED=""
if [ -n "$OLD_SHA" ] && [ -n "$NEW_SHA" ] && [ "$OLD_SHA" != "$NEW_SHA" ]; then
  CHANGED="$(git diff --name-only "$OLD_SHA" "$NEW_SHA")"
fi

changed_matches() { echo "$CHANGED" | grep -Eq "$1"; }

BACKEND_DEPS_CHANGED=0
BACKEND_CHANGED=0
BACKEND_DOCKER_CHANGED=0
DASHBOARD_DEPS_CHANGED=0
DASHBOARD_CHANGED=0
DASHBOARD_DOCKER_CHANGED=0
COMPOSE_CHANGED=0
MIGRATIONS_CHANGED=0

if [ -z "$OLD_SHA" ] || [ -z "$NEW_SHA" ] || [ "$OLD_SHA" = "$NEW_SHA" ]; then
  # No git diff available (skip-git / non-git checkout / already up to
  # date) — treat everything as potentially changed so a manual re-run
  # still rebuilds/restarts correctly instead of silently doing nothing.
  BACKEND_DEPS_CHANGED=1; BACKEND_CHANGED=1; DASHBOARD_DEPS_CHANGED=1; DASHBOARD_CHANGED=1
else
  if changed_matches '^backend/(package\.json|package-lock\.json)$'; then BACKEND_DEPS_CHANGED=1; fi
  if changed_matches '^backend/(src|scripts)/'; then BACKEND_CHANGED=1; fi
  if changed_matches '^backend/Dockerfile'; then BACKEND_DOCKER_CHANGED=1; fi
  if changed_matches '^dashboard/(package\.json|pnpm-lock\.yaml)$'; then DASHBOARD_DEPS_CHANGED=1; fi
  if changed_matches '^dashboard/(src|index\.html|vite\.config\.ts|config\.ts|tailwind\.config\.mjs)'; then DASHBOARD_CHANGED=1; fi
  if changed_matches '^dashboard/(Dockerfile|nginx\.conf)'; then DASHBOARD_DOCKER_CHANGED=1; fi
  if changed_matches '^docker-compose(\.prod)?\.yml$'; then COMPOSE_CHANGED=1; fi
  if changed_matches '^backend/scripts/.*(migrat|rename)'; then MIGRATIONS_CHANGED=1; fi
  if changed_matches '^\.env\.example$|^backend/\.env\.example$|^dashboard/\.env\.example$'; then
    log_warn "A .env.example file changed upstream — compare it with your local .env files for new/renamed variables."
  fi
fi
if [ "$BACKEND_DEPS_CHANGED" -eq 1 ]; then BACKEND_CHANGED=1; fi
if [ "$DASHBOARD_DEPS_CHANGED" -eq 1 ]; then DASHBOARD_CHANGED=1; fi

if [ "$MIGRATIONS_CHANGED" -eq 1 ]; then
  log_warn "backend/scripts/ contains changed migration-style scripts (e.g. rename-iqvizyon-dictionary-2026-08-30.ts)."
  log_warn "These are NOT run automatically (data safety) — review backend/package.json's 'migrate:*' scripts and run the relevant one manually if it applies to this install."
fi

iqv_ensure_root_env
iqv_load_root_env

if [ "$MODE" = "docker" ]; then
  docker_available || fail "This install was recorded as Docker-based, but Docker is not available now."

  if [ "$BACKEND_DOCKER_CHANGED" -eq 1 ] || [ "$DASHBOARD_DOCKER_CHANGED" -eq 1 ] || [ "$COMPOSE_CHANGED" -eq 1 ] || [ "$BACKEND_DEPS_CHANGED" -eq 1 ] || [ "$DASHBOARD_DEPS_CHANGED" -eq 1 ] || [ "$BACKEND_CHANGED" -eq 1 ] || [ "$DASHBOARD_CHANGED" -eq 1 ]; then
    log_info "Rebuilding production images..."
    docker compose -f "$IQV_COMPOSE_PROD" --env-file "$IQV_REPO_ROOT/.env" build
  else
    log_info "No backend/dashboard/Docker changes detected — skipping image rebuild."
  fi

  log_info "Recreating containers (only what changed)..."
  docker compose -f "$IQV_COMPOSE_PROD" --env-file "$IQV_REPO_ROOT/.env" up -d

  ok=1
  iqv_wait_http_ok "http://127.0.0.1:${IQV_BACKEND_PORT}/health" "Backend" 40 3 || ok=0
  iqv_wait_http_ok "http://127.0.0.1:${IQV_FRONTEND_PORT}/" "Frontend" 40 3 || ok=0
  log_check "Docker ......... OK"
else
  PM2_BIN="$(pm2_bin)" || fail "This install was recorded as native, but PM2 is not on PATH."

  if [ "$BACKEND_DEPS_CHANGED" -eq 1 ]; then
    log_info "Backend dependencies changed — running npm ci..."
    (cd "$IQV_REPO_ROOT/backend" && npm ci)
  fi
  if [ "$BACKEND_CHANGED" -eq 1 ]; then
    log_info "Rebuilding backend..."
    (cd "$IQV_REPO_ROOT/backend" && npm run build)
  else
    log_info "No backend changes detected — skipping backend rebuild."
  fi

  if [ "$DASHBOARD_DEPS_CHANGED" -eq 1 ]; then
    log_info "Dashboard dependencies changed — running pnpm install --frozen-lockfile..."
    corepack enable >/dev/null 2>&1 || true
    (cd "$IQV_REPO_ROOT/dashboard" && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile)
  fi
  if [ "$DASHBOARD_CHANGED" -eq 1 ]; then
    log_info "Rebuilding dashboard..."
    (cd "$IQV_REPO_ROOT/dashboard" && pnpm run build)
  else
    log_info "No dashboard changes detected — skipping dashboard rebuild."
  fi

  log_info "Restarting IQV Dictionary under PM2..."
  "$PM2_BIN" startOrReload "$IQV_ECOSYSTEM" --update-env || "$PM2_BIN" restart "$IQV_ECOSYSTEM"
  "$PM2_BIN" save

  ok=1
  iqv_wait_http_ok "http://127.0.0.1:${IQV_BACKEND_PORT}/health" "Backend" 30 2 || ok=0
  iqv_wait_http_ok "http://127.0.0.1:${IQV_FRONTEND_PORT}/" "Frontend" 30 2 || ok=0
fi

iqv_state_write "$MODE" "$IQV_BACKEND_PORT" "$IQV_FRONTEND_PORT"

if [ "$ok" -ne 1 ]; then
  fail "IQV Dictionary was updated to $NEW_VERSION but one or more services failed their post-update healthcheck. Check logs."
fi

log_check "Health .......... OK"
echo "============================================================"
echo "[OK] IQV Dictionary updated successfully."
echo "Version: $NEW_VERSION"
echo "============================================================"
