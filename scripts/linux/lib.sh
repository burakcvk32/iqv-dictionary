#!/usr/bin/env bash
# ============================================================
# IQV Dictionary — shared Bash helpers for scripts/linux/*.sh.
# Sourced by install.sh / update.sh / uninstall.sh. Not meant to be run
# directly (it defines functions/vars, no side effects on its own).
# ============================================================

# ---- logging ----
IQV_C_RESET='\033[0m'
IQV_C_INFO='\033[0;36m'
IQV_C_OK='\033[0;32m'
IQV_C_WARN='\033[0;33m'
IQV_C_ERR='\033[0;31m'

log_info()  { printf "%b[INFO]%b  %s\n"  "$IQV_C_INFO" "$IQV_C_RESET" "$1"; }
log_check() { printf "%b[CHECK]%b %s\n" "$IQV_C_INFO" "$IQV_C_RESET" "$1"; }
log_ok()    { printf "%b[OK]%b    %s\n"  "$IQV_C_OK"   "$IQV_C_RESET" "$1"; }
log_warn()  { printf "%b[WARN]%b  %s\n"  "$IQV_C_WARN" "$IQV_C_RESET" "$1"; }
log_err()   { printf "%b[ERROR]%b %s\n"  "$IQV_C_ERR"  "$IQV_C_RESET" "$1" >&2; }

fail() {
  log_err "$1"
  exit "${2:-1}"
}

# ---- paths (lib.sh lives at <repo_root>/scripts/linux/lib.sh) ----
IQV_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IQV_REPO_ROOT="$(cd "$IQV_LIB_DIR/../.." && pwd)"
IQV_STATE_DIR="$IQV_REPO_ROOT/.iqv-install"
IQV_STATE_FILE="$IQV_STATE_DIR/state.json"
IQV_VERSION_FILE="$IQV_REPO_ROOT/VERSION"
IQV_COMPOSE_PROD="$IQV_REPO_ROOT/docker-compose.prod.yml"
IQV_COMPOSE_DEV="$IQV_REPO_ROOT/docker-compose.yml"
IQV_ECOSYSTEM="$IQV_REPO_ROOT/scripts/common/ecosystem.config.js"

iqv_version() {
  if [ -f "$IQV_VERSION_FILE" ]; then
    tr -d '[:space:]' < "$IQV_VERSION_FILE"
  else
    echo "unknown"
  fi
}

# ---- command detection ----
has_cmd() { command -v "$1" >/dev/null 2>&1; }

docker_available() {
  has_cmd docker || return 1
  docker info >/dev/null 2>&1 || return 1
  docker compose version >/dev/null 2>&1 || return 1
  return 0
}

pm2_bin() {
  # Resolve pm2 regardless of whether it was just installed in this same
  # shell (PATH may not have refreshed for `npm install -g` yet).
  # NOTE: `npm bin -g` was removed in npm 9+ (ships with Node 20, our
  # required version) — `npm config get prefix` remains supported and is
  # used instead to derive the global bin directory.
  if has_cmd pm2; then
    echo pm2
    return 0
  fi
  local npm_prefix
  if npm_prefix="$(npm config get prefix 2>/dev/null)" && [ -x "$npm_prefix/bin/pm2" ]; then
    echo "$npm_prefix/bin/pm2"
    return 0
  fi
  return 1
}

# ---- state file (JSON; parsed/written via node, which is already a
# hard prerequisite — no extra dependency like jq is introduced) ----
iqv_state_get() {
  # $1 = top-level key
  [ -f "$IQV_STATE_FILE" ] || return 1
  node -e "
    try {
      const s = require(process.argv[1]);
      const v = s[process.argv[2]];
      if (v === undefined || v === null) process.exit(1);
      process.stdout.write(String(v));
    } catch (e) { process.exit(1); }
  " "$IQV_STATE_FILE" "$1" 2>/dev/null
}

iqv_state_write() {
  # $1 = mode (docker|native), $2 = backend port, $3 = frontend port
  mkdir -p "$IQV_STATE_DIR"
  local mode="$1" backend_port="$2" frontend_port="$3"
  local now created_at existing
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  created_at="$now"
  if existing="$(iqv_state_get installedAt)"; then
    created_at="$existing"
  fi
  local backend_svc frontend_svc
  if [ "$mode" = "docker" ]; then
    backend_svc="iqv-dictionary-backend-prod"
    frontend_svc="iqv-dictionary-frontend-prod"
  else
    backend_svc="iqv-dictionary-backend"
    frontend_svc="iqv-dictionary-frontend"
  fi
  cat > "$IQV_STATE_FILE" <<JSON
{
  "mode": "$mode",
  "version": "$(iqv_version)",
  "installPath": "$IQV_REPO_ROOT",
  "installedAt": "$created_at",
  "updatedAt": "$now",
  "services": {
    "backend": "$backend_svc",
    "frontend": "$frontend_svc"
  },
  "ports": {
    "backend": $backend_port,
    "frontend": $frontend_port
  }
}
JSON
}

iqv_installed_mode() {
  local m
  if m="$(iqv_state_get mode)"; then
    echo "$m"
    return 0
  fi
  if has_cmd docker && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^iqv-dictionary-.*-prod$'; then
    echo docker
    return 0
  fi
  local pm2
  if pm2="$(pm2_bin)" && "$pm2" list 2>/dev/null | grep -q 'iqv-dictionary-'; then
    echo native
    return 0
  fi
  return 1
}

# ---- env files ----
# Generates a safe random JWT secret locally when backend/.env does not
# exist yet — never written into backend/.env.example (which stays a
# names-only template, see repo README "Environment Variables").
iqv_ensure_backend_env() {
  local env_file="$IQV_REPO_ROOT/backend/.env"
  local example="$IQV_REPO_ROOT/backend/.env.example"
  if [ -f "$env_file" ]; then
    log_ok "backend/.env already exists — leaving it as-is."
    return 0
  fi
  [ -f "$example" ] || fail "backend/.env.example not found — cannot bootstrap backend/.env."
  cp "$example" "$env_file"
  local secret
  secret="$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")"
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$secret|" "$env_file"
  rm -f "$env_file.bak"
  log_ok "Created backend/.env from .env.example with a freshly generated JWT_SECRET."
  log_warn "Review backend/.env (MongoDB URI / CORS_ORIGIN) before relying on this install."
}

iqv_ensure_dashboard_env() {
  local env_file="$IQV_REPO_ROOT/dashboard/.env"
  local example="$IQV_REPO_ROOT/dashboard/.env.example"
  if [ -f "$env_file" ]; then
    log_ok "dashboard/.env already exists — leaving it as-is."
    return 0
  fi
  [ -f "$example" ] || fail "dashboard/.env.example not found — cannot bootstrap dashboard/.env."
  cp "$example" "$env_file"
  log_ok "Created dashboard/.env from .env.example."
}

iqv_ensure_root_env() {
  local env_file="$IQV_REPO_ROOT/.env"
  local example="$IQV_REPO_ROOT/.env.example"
  if [ -f "$env_file" ]; then
    return 0
  fi
  [ -f "$example" ] || return 0
  cp "$example" "$env_file"
  log_ok "Created root .env (Docker Compose ports / build args) from .env.example."
}

iqv_load_root_env() {
  IQV_FRONTEND_PORT="${IQV_FRONTEND_PORT:-8080}"
  IQV_BACKEND_PORT="${IQV_BACKEND_PORT:-3001}"
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:3001}"
  local env_file="$IQV_REPO_ROOT/.env"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
  export IQV_FRONTEND_PORT IQV_BACKEND_PORT VITE_API_BASE_URL
}

# ---- healthchecks ----
iqv_wait_http_ok() {
  # $1 = url, $2 = label, $3 = max attempts (default 30), $4 = sleep seconds (default 2)
  local url="$1" label="$2" attempts="${3:-30}" sleep_s="${4:-2}" i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      log_check "$label ........ OK"
      return 0
    fi
    sleep "$sleep_s"
    i=$((i + 1))
  done
  log_check "$label ........ FAIL"
  return 1
}

# ---- git ----
iqv_is_git_repo() {
  git -C "$IQV_REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

iqv_git_dirty() {
  [ -n "$(git -C "$IQV_REPO_ROOT" status --porcelain 2>/dev/null)" ]
}
