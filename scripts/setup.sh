#!/usr/bin/env bash
# =============================================================================
# OpenShell-on-Kubernetes launchable — single-VM bring-up.
#
# This is the entrypoint the Brev Launchable runs. On ONE Ubuntu VM it:
#   1. installs Ansible + host deps
#   2. generates a localhost inventory + a secrets file from your .env
#   3. runs the Ansible playbook (gVisor → k3s → agent-sandbox → LiteLLM →
#      OpenShell gateway → inference routing → optional Kyverno/monitoring →
#      an initial agent sandbox)
#   4. prints how to reach the cluster, the gateway, and the agent fleet.
#
# Re-runnable: every step is idempotent, so you can run it again after editing
# .env. Run a subset with ANSIBLE_TAGS, e.g.  ANSIBLE_TAGS=gateway ./scripts/setup.sh
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ANSIBLE_DIR="$ROOT/ansible"

# ---- logging ----------------------------------------------------------------
log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# sudo only if we're not already root
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || die "Need root or sudo to install packages and k3s."
  SUDO="sudo"
fi

# ---- load .env --------------------------------------------------------------
if [[ -f "$ROOT/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$ROOT/.env"; set +a
  log "Loaded $ROOT/.env"
else
  warn "No .env found — copy .env.example to .env and fill in OPENSHELL_API_KEY."
  warn "Continuing with defaults (the gateway will come up, but inference will fail without a key)."
fi

# ---- config (env or defaults) ----------------------------------------------
OPENSHELL_API_KEY="${OPENSHELL_API_KEY:-}"
OPENSHELL_BASE_URL="${OPENSHELL_BASE_URL:-https://integrate.api.nvidia.com/v1}"
OPENSHELL_MODEL="${OPENSHELL_MODEL:-meta/llama-3.3-70b-instruct}"
ENABLE_GVISOR="${ENABLE_GVISOR:-true}"
ENABLE_KYVERNO="${ENABLE_KYVERNO:-true}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
CREATE_FLEET="${CREATE_FLEET:-true}"
FLEET_SIZE="${FLEET_SIZE:-1}"
GATEWAY_NODEPORT="${GATEWAY_NODEPORT:-30808}"
ENABLE_OPENCLAW_UI="${ENABLE_OPENCLAW_UI:-true}"
OPENCLAW_UI_PORT="${OPENCLAW_UI_PORT:-30789}"
OPENCLAW_GATEWAY_PASSWORD="${OPENCLAW_GATEWAY_PASSWORD:-openshell-wad26}"
# The browser-facing URL for the OpenClaw UI. On Brev/launchpad this is its own
# Secure Link (a SEPARATE subdomain, not the same host on a different port —
# unlike GATEWAY_NODEPORT/etc. this one can't be "same host, expose the port"
# because Brev's edge only terminates HTTPS per-subdomain-per-port-mapping, not
# per-arbitrary-port on one host). Auto-derived below like PUBLIC_BASE_URL, using
# a different prefix (OPENCLAW_UI_URL_PREFIX) on the same <brevid>.<domain>. Set
# OPENCLAW_UI_URL directly to override (e.g. a non-Brev host).
OPENCLAW_UI_URL="${OPENCLAW_UI_URL:-}"
OPENCLAW_UI_URL_PREFIX="${OPENCLAW_UI_URL_PREFIX:-openclaw}"
ENABLE_WORKSHOP="${ENABLE_WORKSHOP:-true}"
WORKSHOP_PORT="${WORKSHOP_PORT:-3000}"
# SSO + ingress bundle. Default ON: Brev does NOT inject Launchable env-config into
# the oncreate setup script, so a no-config deploy must default to the intended
# single-public-URL experience (Keycloak + Envoy + socat on ENVOY_HOST_PORT 3001 —
# the port the launchable exposes). PUBLIC_BASE_URL auto-derives from the hostname.
# Set ENABLE_SSO=false in .env for a bare site-on-:3000 dev run.
ENABLE_SSO="${ENABLE_SSO:-true}"
ENABLE_HEADLAMP="${ENABLE_HEADLAMP:-false}"
ENABLE_CONSOLE="${ENABLE_CONSOLE:-true}"
# Keeps Keycloak/Grafana behind SSO (still gated by ENABLE_SSO) while the
# OpenShell Console itself runs open (no login) — a learner clicking around
# their own single-tenant lab box doesn't need a login wall on the console
# specifically. Set true to gate the console behind Keycloak too.
ENABLE_CONSOLE_SSO="${ENABLE_CONSOLE_SSO:-false}"
# Track whether the operator gave these explicitly — a derived base built from the
# DEFAULT domain silently bakes the launchpad host into every SSO URL (Keycloak
# issuer, realm redirect URIs, AUTH_URL, Grafana), which breaks sign-in on any other
# host (e.g. brevlab.com). We warn on that below instead of failing silently.
[[ -n "${PUBLIC_BASE_URL:-}" ]] && PUBLIC_BASE_URL_EXPLICIT=1 || PUBLIC_BASE_URL_EXPLICIT=0
[[ -n "${BREV_URL_DOMAIN:-}" ]] && BREV_URL_DOMAIN_EXPLICIT=1 || BREV_URL_DOMAIN_EXPLICIT=0
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
BREV_URL_PREFIX="${BREV_URL_PREFIX:-openshell}"
# Domain that fronts exposed ports on this Brev/launchpad. The public URL is
# https://<prefix>-<brevid>.<domain>. Default targets NVIDIA launchpad (the
# zero-config platform); set BREV_URL_DOMAIN or PUBLIC_BASE_URL for any other host.
BREV_URL_DOMAIN="${BREV_URL_DOMAIN:-brevlab.com}"
ENVOY_WEB_NODEPORT="${ENVOY_WEB_NODEPORT:-30080}"
ENVOY_GRPC_NODEPORT="${ENVOY_GRPC_NODEPORT:-30081}"
# Host port the launchpad/Brev "Secure Link" actually tunnels for the web ingress.
# The NVIDIA launchpad only forwards LOW host ports (e.g. 3000/3001) — pointing a public
# DNS at a high NodePort (30080) returns an edge 503 (server: envoy). So the Envoy socket
# forwarder (publish_envoy_socket) binds this LOW port and you point your public DNS
# (https://<prefix>-<brevid>.<domain>, kept as openshell-*) here. The k8s NodePort
# (envoy_web_nodeport, 30080) stays untouched in the valid 30000-32767 range for Ansible.
ENVOY_HOST_PORT="${ENVOY_HOST_PORT:-3001}"

# Auto-derive the public URL when SSO is on and no explicit URL was given:
#   https://<prefix>-<brevid>.<domain>   (brevid = host's "brev-XXXX" suffix)
# brevid itself doesn't depend on SSO — OPENCLAW_UI_URL below needs it too.
brevid="$(hostname | sed -n 's/^brev-//p')"
[[ -z "$brevid" ]] && brevid="${BREV_ENV_ID:-}"
if [[ "$ENABLE_SSO" == "true" && -z "$PUBLIC_BASE_URL" ]]; then
  if [[ -n "$brevid" ]]; then
    PUBLIC_BASE_URL="https://${BREV_URL_PREFIX}-${brevid}.${BREV_URL_DOMAIN}"
  fi
fi
OPENCLAW_UI_URL_EXPLICIT=0
[[ -n "${OPENCLAW_UI_URL}" ]] && OPENCLAW_UI_URL_EXPLICIT=1
if [[ "$ENABLE_OPENCLAW_UI" == "true" && -z "$OPENCLAW_UI_URL" && -n "$brevid" ]]; then
  OPENCLAW_UI_URL="https://${OPENCLAW_UI_URL_PREFIX}-${brevid}.${BREV_URL_DOMAIN}"
fi

# ---- preflight --------------------------------------------------------------
log "Preflight checks"
[[ -r /etc/os-release ]] && . /etc/os-release || true
[[ "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] || \
  warn "This launchable targets Ubuntu/Debian; '${ID:-unknown}' may need manual tweaks."

cores="$(nproc 2>/dev/null || echo '?')"
memgb="$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo '?')"
log "Host: ${cores} vCPU, ${memgb} GB RAM, arch $(uname -m)"
[[ "$cores" =~ ^[0-9]+$ && "$cores" -lt 4 ]] && warn "Fewer than 4 vCPU — the stack will be slow."
[[ "$memgb" =~ ^[0-9]+$ && "$memgb" -lt 8 ]] && warn "Less than 8 GB RAM — expect pressure; 16 GB recommended."

if [[ "$ENABLE_OPENCLAW_UI" == "true" && "$OPENCLAW_UI_URL_EXPLICIT" == "0" && "$BREV_URL_DOMAIN_EXPLICIT" == "0" ]]; then
  warn "OPENCLAW_UI_URL was derived using the DEFAULT domain '${BREV_URL_DOMAIN}'."
  warn "If this box is served on a different host (e.g. brevlab.com), set BREV_URL_DOMAIN"
  warn "or OPENCLAW_UI_URL directly in .env and re-run, or the console's OpenClaw UI link will be wrong."
fi

if [[ -z "$OPENSHELL_API_KEY" ]]; then
  warn "OPENSHELL_API_KEY is empty — the cluster + gateway will deploy, but the agent"
  warn "cannot call the model until you set it in .env and re-run (or 'openshell inference set')."
fi

# SSO bundle preflight + persistent secret generation.
SSO_SECRETS_BLOCK=""
if [[ "$ENABLE_SSO" == "true" ]]; then
  [[ -n "$PUBLIC_BASE_URL" ]] || die "ENABLE_SSO=true but PUBLIC_BASE_URL is empty and brevid could not be derived. Set PUBLIC_BASE_URL in .env (the public https URL fronting Envoy host port ${ENVOY_HOST_PORT})."
  log "SSO enabled — public base URL: ${PUBLIC_BASE_URL}"
  # Loudly flag the silent-wrong-host footgun: base was DERIVED from the DEFAULT
  # launchpad domain. Everything baked below (Keycloak issuer/redirect URIs,
  # AUTH_URL, Grafana SSO, Links page fallback) will point at launchpad; sign-in
  # fails if this box is actually served on another host (e.g. brevlab.com).
  if [[ "$PUBLIC_BASE_URL_EXPLICIT" == "0" && "$BREV_URL_DOMAIN_EXPLICIT" == "0" ]]; then
    warn "PUBLIC_BASE_URL was derived using the DEFAULT domain '${BREV_URL_DOMAIN}'."
    warn "If this box is served on a different host, set BREV_URL_DOMAIN (e.g. 'brevlab.com')"
    warn "or PUBLIC_BASE_URL in .env and re-run, or console/Grafana SSO will point at the wrong host."
  fi
  # The trap that actually breaks re-runs: an EXPLICIT PUBLIC_BASE_URL silently wins over
  # BREV_URL_DOMAIN (the derivation above is skipped when PUBLIC_BASE_URL is already set).
  # So editing BREV_URL_DOMAIN=brevlab.com while a stale PUBLIC_BASE_URL=…launchpad… lingers
  # in .env changes nothing. Detect the host mismatch and say so loudly.
  if [[ "$PUBLIC_BASE_URL_EXPLICIT" == "1" && "$BREV_URL_DOMAIN_EXPLICIT" == "1" ]]; then
    pub_host="${PUBLIC_BASE_URL#*://}"; pub_host="${pub_host%%/*}"
    if [[ "$pub_host" != *".${BREV_URL_DOMAIN}" && "$pub_host" != "$BREV_URL_DOMAIN" ]]; then
      warn "PUBLIC_BASE_URL (${PUBLIC_BASE_URL}) is NOT under BREV_URL_DOMAIN (${BREV_URL_DOMAIN})."
      warn "PUBLIC_BASE_URL wins and BREV_URL_DOMAIN is ignored — every SSO URL uses '${pub_host}'."
      warn "Update PUBLIC_BASE_URL to the intended host, or clear it so BREV_URL_DOMAIN derives the base."
    fi
  fi
  command -v openssl >/dev/null 2>&1 || { $SUDO apt-get install -y openssl >/dev/null 2>&1 || true; }
  # Persist generated secrets so re-runs reuse them (Keycloak realm clients must
  # keep stable secrets). Stored gitignored alongside the repo.
  SSO_CACHE="$ROOT/.sso-secrets.env"
  # shellcheck disable=SC1090
  [[ -f "$SSO_CACHE" ]] && source "$SSO_CACHE"
  gen() { openssl rand -hex 24 2>/dev/null || head -c32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c40; }
  KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-$(gen)}"
  KC_DEMO_PASSWORD="${KC_DEMO_PASSWORD:-$(gen)}"
  HEADLAMP_CLIENT_SECRET="${HEADLAMP_CLIENT_SECRET:-$(gen)}"
  GRAFANA_CLIENT_SECRET="${GRAFANA_CLIENT_SECRET:-$(gen)}"
  CONSOLE_CLIENT_SECRET="${CONSOLE_CLIENT_SECRET:-$(gen)}"
  CONSOLE_AUTH_SECRET="${CONSOLE_AUTH_SECRET:-$(openssl rand -base64 32 2>/dev/null || gen)}"
  cat > "$SSO_CACHE" <<EOF
# Generated by scripts/setup.sh — DO NOT COMMIT. Stable SSO secrets (reused across runs).
KC_ADMIN_PASSWORD='${KC_ADMIN_PASSWORD}'
KC_DEMO_PASSWORD='${KC_DEMO_PASSWORD}'
HEADLAMP_CLIENT_SECRET='${HEADLAMP_CLIENT_SECRET}'
GRAFANA_CLIENT_SECRET='${GRAFANA_CLIENT_SECRET}'
CONSOLE_CLIENT_SECRET='${CONSOLE_CLIENT_SECRET}'
CONSOLE_AUTH_SECRET='${CONSOLE_AUTH_SECRET}'
EOF
  chmod 600 "$SSO_CACHE"
  log "Keycloak admin: admin / ${KC_ADMIN_PASSWORD}   (demo user: demo / ${KC_DEMO_PASSWORD})"
  # Block appended to the Ansible secrets file below.
  SSO_SECRETS_BLOCK="$(cat <<EOF

# --- SSO + ingress (ENABLE_SSO) ---
keycloak_enabled: true
# Keep the OpenShell GATEWAY itself unauthenticated even with Keycloak on. The
# gateway validates its OIDC issuer at startup and crash-loops if it's not
# reachable yet (Envoy ingress + the public Brev URL come up later / out-of-band).
# Keycloak still secures the browser UIs (Grafana/Headlamp/Console); the gateway
# stays dev-mode, which also lets the in-site console BFF call it without a token.
auth_mode: "unauthenticated"
apiserver_oidc_enabled: true
envoy_gateway_enabled: true
grafana_oidc_enabled: ${ENABLE_MONITORING}
headlamp_enabled: ${ENABLE_HEADLAMP}
# The console is now built into the teaching site at <site>/console (served by the
# workshop service), so the standalone console deployment + Envoy /console route
# are NOT used.
openshell_ui_enabled: false
keycloak_base_url: "${PUBLIC_BASE_URL}"
envoy_web_nodeport: ${ENVOY_WEB_NODEPORT}
envoy_grpc_nodeport: ${ENVOY_GRPC_NODEPORT}
keycloak_admin_password: "${KC_ADMIN_PASSWORD}"
keycloak_demo_user: "demo"
keycloak_demo_password: "${KC_DEMO_PASSWORD}"
headlamp_client_secret: "${HEADLAMP_CLIENT_SECRET}"
grafana_client_secret: "${GRAFANA_CLIENT_SECRET}"
openshell_ui_client_secret: "${CONSOLE_CLIENT_SECRET}"
openshell_ui_auth_secret: "${CONSOLE_AUTH_SECRET}"
EOF
)"
fi

# ---- host deps: Ansible -----------------------------------------------------
if ! command -v ansible-playbook >/dev/null 2>&1; then
  log "Installing Ansible + deps (apt)"
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  $SUDO apt-get install -y ansible python3 python3-pip curl git ca-certificates \
    || { warn "apt install of ansible failed; trying pip"; $SUDO python3 -m pip install --upgrade ansible-core; }
else
  log "Ansible already present: $(ansible-playbook --version | head -1)"
fi

# ---- generate inventory (localhost, no SSH) ---------------------------------
log "Writing single-node localhost inventory"
cat > "$ANSIBLE_DIR/inventory/hosts.ini" <<'EOF'
# Generated by scripts/setup.sh — single-node, runs against this VM with no SSH.
[server]
localhost ansible_connection=local ansible_python_interpreter=/usr/bin/python3

[agents]

[k3s_cluster:children]
server
agents
EOF

# ---- generate secrets / launchable overrides --------------------------------
# Written from .env so the reusable Ansible defaults (group_vars/all.yml) stay
# generic. Passed to the playbook via -e. Gitignored (contains the API key).
SECRETS="$ANSIBLE_DIR/inventory/group_vars/secrets.yml"
log "Rendering $SECRETS from .env"
cat > "$SECRETS" <<EOF
# Generated by scripts/setup.sh from .env — DO NOT COMMIT (contains the API key).
upstream_api_key: "${OPENSHELL_API_KEY}"
upstream_base_url: "${OPENSHELL_BASE_URL}"
litellm_models:
  - name: "${OPENSHELL_MODEL}"
    model: "${OPENSHELL_MODEL}"
inference_model: "${OPENSHELL_MODEL}"

# Single-VM launchable toggles (mirrors .env)
gvisor_enabled: ${ENABLE_GVISOR}
kyverno_enabled: ${ENABLE_KYVERNO}
monitoring_enabled: ${ENABLE_MONITORING}
sandboxes_enabled: ${CREATE_FLEET}
fleet_size: ${FLEET_SIZE}
gateway_nodeport: ${GATEWAY_NODEPORT}
openclaw_ui_enabled: ${ENABLE_OPENCLAW_UI}
openclaw_ui_port: ${OPENCLAW_UI_PORT}
openclaw_gateway_password: "${OPENCLAW_GATEWAY_PASSWORD}"
${SSO_SECRETS_BLOCK}
EOF
chmod 600 "$SECRETS"

# ---- run the playbook -------------------------------------------------------
log "Running Ansible playbook (this pulls images and can take 5-15 min on first boot)"
TAGS_ARG=()
[[ -n "${ANSIBLE_TAGS:-}" ]] && TAGS_ARG=(--tags "$ANSIBLE_TAGS")

(
  cd "$ANSIBLE_DIR"
  ansible-playbook site.yml \
    -e @inventory/group_vars/secrets.yml \
    "${TAGS_ARG[@]}"
) || die "Ansible run failed — see the output above. Fix and re-run ./scripts/setup.sh"

# ---- point the lab user's openshell CLI at the gateway ----------------------
# The playbook configures the CLI as root (ansible/roles/10-inference_routing), but the
# interactive lab shell (SSH + the in-browser terminal) runs as the box's primary user —
# whose CLI otherwise has only the default mtls "openshell" gateway that `install.sh`
# auto-creates on first run (a DIFFERENT CA than the cluster's, since it's a local
# homebrew/docker gateway, not this cluster's). The gateway always terminates mTLS now
# (see ansible/roles/09-openshell_gateway/files/values.yaml), so this user's CLI needs the
# same client-cert bootstrap role 10 does for root: pull the cert out of the
# openshell-client-tls Secret before registering, then select it and drop the poisoned
# auto-created default.
configure_lab_cli() {
  local u="$1"
  id "$u" >/dev/null 2>&1 || return 0
  local -a run
  if [[ "$(id -un)" == "$u" ]]; then run=(bash -lc); else run=(sudo -u "$u" -H bash -lc); fi
  "${run[@]}" '
    export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    command -v openshell >/dev/null 2>&1 || exit 0
    command -v kubectl >/dev/null 2>&1 || exit 0
    mtls_dir="$HOME/.config/openshell/gateways/fleet/mtls"
    mkdir -p "$mtls_dir"
    # remove first: `gateway add` is a no-op (not an overwrite) against an
    # existing name — a stale plaintext "fleet" from before mTLS would
    # otherwise stick around and every CLI call would fail with an opaque
    # transport error against the now-mTLS-only gateway.
    openshell gateway remove fleet >/dev/null 2>&1 || true
    # `--local` (per its own --help: "Register a LOCAL mTLS gateway running in
    # DOCKER on this machine") unconditionally (re)provisions its own fixed
    # dev-mode self-signed CA into gateways/<name>/mtls/ the moment it runs —
    # verified live: it overwrites ca.crt/tls.crt/tls.key with the exact same
    # bundled dev cert every time, regardless of what is already on disk. So
    # our real k3s-issued certs MUST be written AFTER `add`, not before, or
    # `add` clobbers them and every call fails with "invalid peer certificate:
    # UnknownIssuer" — the endpoint here is a k3s NodePort, not an actual
    # local Docker gateway, so nothing about that dev CA is usable anyway.
    # It ALSO requires the cert files to already exist as a precondition
    # (content does not matter — verified live empty files satisfy it) or it
    # errors outright with "mTLS certificates ... were not found"; touch
    # placeholders first, then retry+verify (a from-scratch $HOME can
    # transiently fail this a few times).
    touch "$mtls_dir/tls.crt" "$mtls_dir/tls.key" "$mtls_dir/ca.crt"
    for _ in 1 2 3 4 5; do
      openshell gateway add https://localhost:'"${GATEWAY_NODEPORT}"' --local --name fleet >/dev/null 2>&1
      openshell gateway list 2>/dev/null | grep -q fleet && break
      sleep 3
    done
    openshell gateway remove openshell >/dev/null 2>&1 || true   # the auto-created mtls default (same dev CA)
    # The Secret object can exist before cert-manager finishes populating its
    # data (create-then-patch) — an empty tls.crt here silently becomes an
    # empty file. Retry until the data is actually there.
    crt=""
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      crt="$(kubectl -n openshell get secret openshell-client-tls -o jsonpath="{.data.tls\.crt}" 2>/dev/null)"
      [ -n "$crt" ] && break
      sleep 3
    done
    echo "$crt" | base64 -d > "$mtls_dir/tls.crt"
    kubectl -n openshell get secret openshell-client-tls -o jsonpath="{.data.tls\.key}" 2>/dev/null | base64 -d > "$mtls_dir/tls.key"
    ca="$(kubectl -n openshell get secret openshell-client-tls -o jsonpath="{.data.ca\.crt}" 2>/dev/null)"
    [ -n "$ca" ] || ca="$(kubectl -n openshell get secret openshell-server-tls -o jsonpath="{.data.ca\.crt}" 2>/dev/null)"
    echo "$ca" | base64 -d > "$mtls_dir/ca.crt"
    chmod 600 "$mtls_dir/tls.key"
    openshell gateway select fleet >/dev/null 2>&1 || true
  ' || true
}
LAB_USER="${LAB_USER:-$(stat -c '%U' "$ROOT" 2>/dev/null || echo ubuntu)}"
log "Pointing ${LAB_USER}'s openshell CLI at the fleet gateway (mtls :${GATEWAY_NODEPORT})"
configure_lab_cli "$LAB_USER"
[[ "$(id -un)" != "$LAB_USER" ]] && configure_lab_cli "$(id -un)"   # also the workshop/in-browser-terminal user

# ---- teaching website (optional) -------------------------------------------
# A Next.js site with lessons + a live in-browser terminal wired to this VM's
# cluster. Best-effort: a failure here must NOT fail the provision — the stack
# is already up. Set ENABLE_WORKSHOP=false to skip.
deploy_workshop() {
  # Every kubectl call below (console cert fetch, EndpointSlice reconcile)
  # needs this — verified live it was NEVER exported before this function's
  # own cert-fetch block ran, so every `kubectl get secret ...` in it failed
  # silently (falls back to a nonexistent default kubeconfig, all wrapped in
  # 2>/dev/null), writing empty (0-byte) cert files every single time —
  # deterministic, not a timing race. The console then failed every gRPC call
  # with an opaque OpenSSL "PEM routines::no start line" trying to parse them.
  export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
  local web="$ROOT/web"
  [[ -d "$web" ]] || { warn "web/ not present — skipping teaching site."; return 0; }

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]]; then
    log "Installing Node.js 20 + build tools (for the teaching site)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs build-essential python3
  fi

  log "Building the teaching site (npm install + next build)"
  # --include=dev is REQUIRED: tailwindcss + @tailwindcss/postcss (and typescript) are
  # devDependencies but are needed at BUILD time. The service runs with NODE_ENV=production,
  # so a plain `npm install` would omit/prune them and `next build` fails with
  # "Cannot find module '@tailwindcss/postcss'". This also makes re-runs (e.g. ANSIBLE_TAGS=…)
  # safe — they won't strip the build deps out from under a working site.
  ( cd "$web" && npm install --include=dev --no-fund --no-audit && npm run build )

  log "Installing the openshell-workshop systemd service on port ${WORKSHOP_PORT}"
  local run_user; run_user="$(id -un)"

  # The console's BFF (web/src/lib/grpc.ts) talks gRPC straight to the gateway,
  # which always terminates mTLS now — give it the same client cert material
  # scripts/setup.sh already fetches for the CLI (see configure_lab_cli).
  # Retry until the Secret's data is actually populated (cert-manager can
  # create the Secret object before patching in its content).
  local tls_dir="/etc/openshell-console-tls"
  $SUDO mkdir -p "$tls_dir"
  local crt=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    crt="$(kubectl -n openshell get secret openshell-client-tls -o jsonpath='{.data.tls\.crt}' 2>/dev/null)"
    [ -n "$crt" ] && break
    sleep 3
  done
  echo "$crt" | base64 -d | $SUDO tee "$tls_dir/tls.crt" >/dev/null
  kubectl -n openshell get secret openshell-client-tls -o jsonpath='{.data.tls\.key}' | base64 -d | $SUDO tee "$tls_dir/tls.key" >/dev/null
  local ca; ca="$(kubectl -n openshell get secret openshell-client-tls -o jsonpath='{.data.ca\.crt}')"
  [ -n "$ca" ] || ca="$(kubectl -n openshell get secret openshell-server-tls -o jsonpath='{.data.ca\.crt}')"
  echo "$ca" | base64 -d | $SUDO tee "$tls_dir/ca.crt" >/dev/null
  $SUDO chown -R "${run_user}:${run_user}" "$tls_dir"
  $SUDO chmod 600 "$tls_dir/tls.key"
  # Reconcile the workshop EndpointSlice to the CURRENT node InternalIP. Wired as an
  # ExecStartPost below so the Envoy upstream self-heals after a VM stop/relaunch (the node
  # IP can change) — without it the slice goes stale and Envoy 503s the workshop route.
  # No-op when the slice doesn't exist (non-SSO) or kubectl can't reach the API.
  $SUDO tee /usr/local/bin/openshell-workshop-endpoint.sh >/dev/null <<'HSH'
#!/usr/bin/env bash
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="${WORKSHOP_NS:-openshell}"
kubectl get endpointslice workshop-host -n "$NS" >/dev/null 2>&1 || exit 0
ip="$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null)"
[ -n "$ip" ] || exit 0
kubectl patch endpointslice workshop-host -n "$NS" --type merge \
  -p "{\"endpoints\":[{\"addresses\":[\"$ip\"],\"conditions\":{\"ready\":true}}]}" >/dev/null 2>&1 || true
HSH
  $SUDO chmod +x /usr/local/bin/openshell-workshop-endpoint.sh
  $SUDO tee /etc/systemd/system/openshell-workshop.service >/dev/null <<EOF
[Unit]
Description=OpenShell-on-Kubernetes teaching site (Next.js + live shell)
After=network-online.target k3s.service
Wants=network-online.target

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${web}
Environment=NODE_ENV=production
Environment=PORT=${WORKSHOP_PORT}
Environment=HOST=0.0.0.0
Environment=KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=WORKSHOP_NS=${OPENSHELL_NS:-openshell}
Environment=LAB_KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=LAB_CWD=${ROOT}
Environment=OPENSHELL_GATEWAY_ENDPOINT=localhost:${GATEWAY_NODEPORT}
Environment=OPENSHELL_GATEWAY_TLS=true
Environment=OPENSHELL_GATEWAY_CA_FILE=${tls_dir}/ca.crt
Environment=OPENSHELL_GATEWAY_CLIENT_CERT_FILE=${tls_dir}/tls.crt
Environment=OPENSHELL_GATEWAY_CLIENT_KEY_FILE=${tls_dir}/tls.key
Environment=PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
Environment=AUTH_URL=${PUBLIC_BASE_URL}
Environment=AUTH_SECRET=${CONSOLE_AUTH_SECRET:-}
Environment=OIDC_ISSUER=$( [[ "${ENABLE_CONSOLE_SSO}" == "true" ]] && printf '%s' "${PUBLIC_BASE_URL:+${PUBLIC_BASE_URL}/auth/realms/openshell}" )
# Server-side OIDC back-channel that bypasses the launchpad Pomerium proxy (which 302s
# server-side fetches to the public host → console SSO dies with error=Configuration).
# Points at the box-local Envoy, which routes /auth → Keycloak without Pomerium in the path.
Environment=OIDC_INTERNAL_ISSUER=$( [[ "${ENABLE_CONSOLE_SSO}" == "true" ]] && printf '%s' "${PUBLIC_BASE_URL:+http://localhost:${ENVOY_HOST_PORT}/auth/realms/openshell}" )
Environment=OIDC_CLIENT_ID=openshell-ui
Environment=OIDC_CLIENT_SECRET=${CONSOLE_CLIENT_SECRET:-}
Environment=OIDC_ROLES_CLAIM=groups
Environment=OIDC_ADMIN_ROLE=openshell-admin
Environment=ENABLE_OPENCLAW_UI=${ENABLE_OPENCLAW_UI}
Environment=OPENCLAW_UI_PORT=${OPENCLAW_UI_PORT}
Environment=OPENCLAW_UI_URL=${OPENCLAW_UI_URL}
Environment=OPENCLAW_GATEWAY_PASSWORD=${OPENCLAW_GATEWAY_PASSWORD}
ExecStart=$(command -v node) ${web}/server.mjs
ExecStartPost=-/usr/local/bin/openshell-workshop-endpoint.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable openshell-workshop.service >/dev/null 2>&1 || true
  # restart (not just enable --now) so a re-run actually serves the fresh build
  $SUDO systemctl restart openshell-workshop.service
  log "Teaching site running on port ${WORKSHOP_PORT}"

  # When SSO is on, route the teaching site (+ /console + the /ws/term WebSocket)
  # THROUGH the Envoy ingress at the single public host, so /, /console, /grafana
  # and /auth are all one origin (required for the console's OIDC redirect). The
  # site runs on the host (systemd), so we expose it to the cluster via a
  # selector-less Service + a manual EndpointSlice pointing at the node:PORT.
  if [[ "${ENABLE_SSO}" == "true" ]]; then
    # Pin the EndpointSlice to the k8s node InternalIP (stable, what kubelet advertises),
    # NOT `hostname -I | awk '{print $1}'` — that returns ALL addrs (docker0, flannel,
    # tailscale…) in an enumeration order that isn't stable across a VM stop/relaunch, so
    # the slice could end up pinned to a bridge IP the Envoy data plane can't reach →
    # Envoy 503 on the workshop route. InternalIP is the address the cluster actually uses.
    local node_ip
    node_ip="$(KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null)"
    [[ -n "${node_ip}" ]] || node_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    log "Routing the teaching site through Envoy (node InternalIP ${node_ip}:${WORKSHOP_PORT})"
    KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl apply -f - <<YAML
apiVersion: v1
kind: Service
metadata: { name: workshop, namespace: ${OPENSHELL_NS:-openshell} }
spec:
  ports: [{ name: http, port: 80, targetPort: ${WORKSHOP_PORT} }]
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: workshop-host
  namespace: ${OPENSHELL_NS:-openshell}
  labels: { kubernetes.io/service-name: workshop }
addressType: IPv4
ports: [{ name: http, port: ${WORKSHOP_PORT} }]
endpoints: [{ addresses: ["${node_ip}"], conditions: { ready: true } }]
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: workshop, namespace: ${OPENSHELL_NS:-openshell} }
spec:
  parentRefs: [{ name: fleet-gw, namespace: ${ENVOY_GATEWAY_NS:-fleet-gateway}, sectionName: web }]
  rules:
    - matches: [{ path: { type: PathPrefix, value: / } }]
      # No request timeout: the Incident Lab streams a long-lived NDJSON response while the fleet
      # investigates (~80s). Envoy Gateway's DEFAULT route timeout is 15s, which would cut the
      # stream mid-investigation (the UI then shows every agent "interrupted" + "network error").
      # "0s" disables the route-level timeout; the app manages its own per-agent timeouts + a
      # heartbeat, and normal page loads are unaffected.
      timeouts: { request: "0s" }
      filters:
        - type: RequestHeaderModifier
          requestHeaderModifier:
            set: [{ name: X-Forwarded-Proto, value: https }]
      backendRefs: [{ name: workshop, port: 80 }]
YAML
    publish_envoy_socket
  fi
}

# Launchpad/Brev "Secure Link" port-forwards reach REAL host sockets, not bare
# kube-proxy NodePorts (iptables-only) — a NodePort destination gives a 503, and the
# launchpad only tunnels LOW host ports anyway. So put a real listening socket on a low
# port (ENVOY_HOST_PORT, 3001) that forwards to the Envoy ingress ClusterIP (same trick
# the OpenShift launchable used socat for). Point your Brev Secure Link / public DNS at
# this port — the k8s NodePort (ENVOY_WEB_NODEPORT) is separate and stays 30080.
publish_envoy_socket() {
  command -v socat >/dev/null 2>&1 || $SUDO apt-get install -y socat >/dev/null 2>&1 || true
  # Envoy Gateway creates the data-plane Service in envoy-gateway-system with a
  # generated name; select it by the owning-gateway label (the Gateway is fleet-gw).
  local cip
  cip=$(KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n envoy-gateway-system get svc \
        -l gateway.envoyproxy.io/owning-gateway-name=fleet-gw \
        -o jsonpath="{.items[0].spec.clusterIP}" 2>/dev/null)
  [[ -n "$cip" ]] || { warn "Envoy data-plane ClusterIP not found — skipping socket forwarder."; return 0; }
  log "Publishing Envoy ingress as a real socket on :${ENVOY_HOST_PORT} (socat to ${cip}:80)"
  $SUDO tee /etc/systemd/system/openshell-envoy-proxy.service >/dev/null <<EOF
[Unit]
Description=Real-socket forwarder host :${ENVOY_HOST_PORT} to Envoy ingress (launchpad Secure Link)
After=k3s.service network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/bin/socat -d TCP-LISTEN:${ENVOY_HOST_PORT},fork,reuseaddr,bind=0.0.0.0 TCP:${cip}:80
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable openshell-envoy-proxy >/dev/null 2>&1 || true
  $SUDO systemctl restart openshell-envoy-proxy
}

if [[ "${ENABLE_WORKSHOP}" == "true" ]]; then
  # ANSIBLE_TAGS means a TARGETED subset run (e.g. `ANSIBLE_TAGS=keycloak`/`litellm`) — the
  # teaching site isn't part of the Ansible play, so don't rebuild it or reinstall its service.
  # This keeps a targeted re-run fast and, crucially, can't take a running site down with a
  # rebuild. Run a full `./scripts/setup.sh` (no tags) when you actually want to redeploy the web.
  if [[ -n "${ANSIBLE_TAGS:-}" ]]; then
    log "ANSIBLE_TAGS=${ANSIBLE_TAGS} set — skipping the teaching-site rebuild + service reinstall (targeted run leaves the running site untouched)."
  else
    deploy_workshop || warn "Teaching site deploy failed (non-fatal) — the core stack is still up. See: journalctl -u openshell-workshop"
  fi
fi

# ---- access summary ---------------------------------------------------------
KUBECONFIG_PATH="/etc/rancher/k3s/k3s.yaml"
NODE_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
cat <<EOF

$(log "Done. OpenShell is running on Kubernetes (k3s) on this VM.")
$( [[ "${ENABLE_WORKSHOP}" == "true" ]] && printf '
  Teaching site (START HERE)
    http://%s:%s/          (lessons + a live in-browser terminal on this cluster)
    http://%s:%s/console   (fleet/sandbox management console)
    expose port %s on Brev to open it from your browser
' "${NODE_IP:-<vm-ip>}" "${WORKSHOP_PORT}" "${NODE_IP:-<vm-ip>}" "${WORKSHOP_PORT}" "${WORKSHOP_PORT}" )
  Cluster
    export KUBECONFIG=${KUBECONFIG_PATH}
    kubectl get nodes
    kubectl -n openshell get pods

  OpenShell gateway (control plane)
    NodePort  : ${NODE_IP:-<vm-ip>}:${GATEWAY_NODEPORT}   (expose this port on Brev for remote CLI)
    in-cluster: svc/openshell.openshell:8080

  Agent fleet (OpenClaw sandboxes)
    ./scripts/fleet status            # list sandboxes + pod readiness
    ./scripts/fleet up ${FLEET_SIZE}                 # (re)scale the fleet
    ./scripts/fleet task "Write a haiku about Kubernetes pods" all
    ./scripts/fleet logs agent-0

  Inference routing : agent → https://inference.local → LiteLLM → ${OPENSHELL_BASE_URL}
  Model             : ${OPENSHELL_MODEL}
$( [[ "${ENABLE_OPENCLAW_UI}" == "true" ]] && printf '
  OpenClaw UI (chat / device pairing, forwarded from agent-0)
    local : http://%s:%s/
    public: %s
    password: %s (override via OPENCLAW_GATEWAY_PASSWORD in .env)
    On Brev/launchpad: add a SEPARATE Secure Link for port %s (its own
    subdomain, e.g. "%s" — same pattern as the main site, NOT the same host on
    a different port) — see brev/launchable.md.
' "${NODE_IP:-<vm-ip>}" "${OPENCLAW_UI_PORT}" "${OPENCLAW_UI_URL:-<set OPENCLAW_UI_URL or BREV_URL_DOMAIN in .env>}" "${OPENCLAW_GATEWAY_PASSWORD}" "${OPENCLAW_UI_PORT}" "${OPENCLAW_UI_URL_PREFIX}" )
$( [[ "${ENABLE_SSO}" == "true" ]] && printf '
  ONE public host — expose ONLY Envoy host port %s on Brev as %s
    Site/lessons: %s/
    Console     : %s/console     (%s)
    Grafana     : %s/grafana     (login via Keycloak)
    Keycloak    : %s/auth        (admin: admin / see .sso-secrets.env)
    Gateway gRPC: %s:%s          (Envoy GRPCRoute; remote openshell CLI)
' "${ENVOY_HOST_PORT}" "${PUBLIC_BASE_URL}" "${PUBLIC_BASE_URL}" "${PUBLIC_BASE_URL}" "$( [[ "${ENABLE_CONSOLE_SSO}" == "true" ]] && echo "login via Keycloak" || echo "open, no login" )" "${PUBLIC_BASE_URL}" "${PUBLIC_BASE_URL}" "${NODE_IP:-<vm-ip>}" "${ENVOY_GRPC_NODEPORT}" )
  Re-run after editing .env:  ./scripts/setup.sh
EOF
