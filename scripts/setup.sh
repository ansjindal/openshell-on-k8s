#!/usr/bin/env bash
# =============================================================================
# OpenShell-on-Kubernetes launchable — single-VM bring-up.
#
# This is the entrypoint the Brev Launchable runs. On ONE Ubuntu VM it:
#   1. installs Ansible + host deps
#   2. generates a localhost inventory + a secrets file from your .env
#   3. runs the Ansible playbook (k3s → agent-sandbox → LiteLLM →
#      cert-manager → Keycloak → OpenShell gateway → CLI + model provider →
#      Kyverno → monitoring → Envoy ingress → Console → skill registry →
#      an initial agent sandbox)
#   4. deploys the training site (lessons + live terminal), unless disabled
#   5. prints how to reach everything.
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
  warn "No .env found — copy .env.example to .env and fill in MODEL_API_KEY."
  warn "Continuing with defaults (the platform comes up, but model calls fail without a key)."
fi

# ---- config (env or defaults) ----------------------------------------------
# The upstream model. The older OPENSHELL_API_KEY / _BASE_URL / _MODEL names still work.
MODEL_API_KEY="${MODEL_API_KEY:-${OPENSHELL_API_KEY:-}}"
MODEL_BASE_URL="${MODEL_BASE_URL:-${OPENSHELL_BASE_URL:-https://integrate.api.nvidia.com/v1}}"
MODEL_NAME="${MODEL_NAME:-${OPENSHELL_MODEL:-meta/llama-3.3-70b-instruct}}"
ENABLE_KYVERNO="${ENABLE_KYVERNO:-true}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
CREATE_FLEET="${CREATE_FLEET:-true}"
FLEET_SIZE="${FLEET_SIZE:-1}"
GATEWAY_NODEPORT="${GATEWAY_NODEPORT:-30808}"
ENABLE_TRAINING="${ENABLE_TRAINING:-${ENABLE_WORKSHOP:-true}}"
TRAINING_PORT="${TRAINING_PORT:-${WORKSHOP_PORT:-3000}}"
# SSO + ingress bundle (Keycloak + Envoy + the Console). Default ON: Brev does
# not pass Launchable env-config to the setup script, so a no-config deploy must
# default to the intended public-URL experience.
ENABLE_SSO="${ENABLE_SSO:-true}"
ENABLE_HEADLAMP="${ENABLE_HEADLAMP:-false}"
# Public hosts. The training site, Keycloak (/auth) and Grafana (/grafana) share
# PUBLIC_BASE_URL; the Console has its own host (CONSOLE_URL). Both are derived
# per Brev instance when empty: https://<prefix>-<brevid>.<domain>.
[[ -n "${PUBLIC_BASE_URL:-}" ]] && PUBLIC_BASE_URL_EXPLICIT=1 || PUBLIC_BASE_URL_EXPLICIT=0
[[ -n "${BREV_URL_DOMAIN:-}" ]] && BREV_URL_DOMAIN_EXPLICIT=1 || BREV_URL_DOMAIN_EXPLICIT=0
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
BREV_URL_PREFIX="${BREV_URL_PREFIX:-openshell}"
BREV_URL_DOMAIN="${BREV_URL_DOMAIN:-}"
CONSOLE_URL="${CONSOLE_URL:-}"
CONSOLE_URL_PREFIX="${CONSOLE_URL_PREFIX:-console}"
ENVOY_WEB_NODEPORT="${ENVOY_WEB_NODEPORT:-30080}"
ENVOY_GRPC_NODEPORT="${ENVOY_GRPC_NODEPORT:-30081}"
# Low host ports a Brev/launchpad Secure Link can forward (the edge only reaches
# real host sockets, not bare NodePorts). Both forward to the Envoy ingress,
# which routes by host name: site/auth/grafana on ENVOY_HOST_PORT, the Console
# on CONSOLE_HOST_PORT.
ENVOY_HOST_PORT="${ENVOY_HOST_PORT:-3001}"
CONSOLE_HOST_PORT="${CONSOLE_HOST_PORT:-3002}"

brevid="$(hostname | sed -n 's/^brev-//p')"
[[ -z "$brevid" ]] && brevid="${BREV_ENV_ID:-}"

# Brev writes the instance's exposed ports, with their public host names, to
# /etc/brev/environment-context.json. Use it to pick the URLs automatically:
#   - the link on a host port gives that URL exactly (3001 site, 3002 console);
#   - otherwise any <name>-<brevid>.<domain> link gives the domain.
# Explicit PUBLIC_BASE_URL / CONSOLE_URL / BREV_URL_DOMAIN win.
BREV_CONTEXT=/etc/brev/environment-context.json
brev_fqdn_for_port() {   # $1 = host port -> fqdn of the link that targets it
  $SUDO test -f "$BREV_CONTEXT" || return 0
  $SUDO cat "$BREV_CONTEXT" 2>/dev/null | python3 -c '
import json, sys
port = int(sys.argv[1])
for p in json.load(sys.stdin).get("ports") or []:
    if p.get("destination_port") == port and p.get("fqdn"):
        print(p["fqdn"]); break' "$1" 2>/dev/null || true
}
brev_domain() {          # domain of any <name>-<brevid>.<domain> link
  [[ -n "$brevid" ]] && $SUDO test -f "$BREV_CONTEXT" || return 0
  $SUDO cat "$BREV_CONTEXT" 2>/dev/null | python3 -c '
import json, sys
mark = "-" + sys.argv[1] + "."
for p in json.load(sys.stdin).get("ports") or []:
    f = p.get("fqdn") or ""
    if mark in f:
        print(f.split(mark, 1)[1]); break' "$brevid" 2>/dev/null || true
}
if [[ -z "$BREV_URL_DOMAIN" ]]; then
  BREV_URL_DOMAIN="$(brev_domain)"
  [[ -n "$BREV_URL_DOMAIN" ]] && BREV_URL_DOMAIN_DETECTED=1
  BREV_URL_DOMAIN="${BREV_URL_DOMAIN:-brevlab.com}"
fi
from_port() { local f; f="$(brev_fqdn_for_port "$1")"; [[ -n "$f" ]] && printf 'https://%s' "$f"; }
derive() { [[ -n "$brevid" ]] && printf 'https://%s-%s.%s' "$1" "$brevid" "$BREV_URL_DOMAIN"; }
if [[ "$ENABLE_SSO" == "true" ]]; then
  [[ -n "$PUBLIC_BASE_URL" ]] || PUBLIC_BASE_URL="$(from_port "$ENVOY_HOST_PORT" || true)"
  [[ -n "$PUBLIC_BASE_URL" ]] || PUBLIC_BASE_URL="$(derive "$BREV_URL_PREFIX" || true)"
  [[ -n "$CONSOLE_URL" ]] || CONSOLE_URL="$(from_port "$CONSOLE_HOST_PORT" || true)"
  [[ -n "$CONSOLE_URL" ]] || CONSOLE_URL="$(derive "$CONSOLE_URL_PREFIX" || true)"
fi

# ---- preflight --------------------------------------------------------------
log "Preflight checks"
[[ -r /etc/os-release ]] && . /etc/os-release || true
[[ "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] || \
  warn "This launchable targets Ubuntu/Debian; '${ID:-unknown}' may need manual tweaks."

cores="$(nproc 2>/dev/null || echo '?')"
memgb="$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo '?')"
log "Host: ${cores} vCPU, ${memgb} GB RAM, arch $(uname -m)"
[[ "$cores" =~ ^[0-9]+$ && "$cores" -lt 8 ]] && warn "Fewer than 8 vCPU — the full stack will be slow."
[[ "$memgb" =~ ^[0-9]+$ && "$memgb" -lt 24 ]] && warn "Less than 24 GB RAM — expect pressure; 32 GB recommended."

if [[ -z "$MODEL_API_KEY" ]]; then
  warn "MODEL_API_KEY is empty — the platform deploys, but agents cannot call the"
  warn "model until you set it in .env and re-run (ANSIBLE_TAGS=litellm ./scripts/setup.sh)."
fi

command -v openssl >/dev/null 2>&1 || { $SUDO apt-get install -y openssl >/dev/null 2>&1 || true; }
gen() { openssl rand -hex 24 2>/dev/null || head -c32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c40; }

# Generated secrets, persisted (gitignored) so re-runs reuse them.
SECRETS_CACHE="$ROOT/.sso-secrets.env"
# shellcheck disable=SC1090
[[ -f "$SECRETS_CACHE" ]] && source "$SECRETS_CACHE"

SSO_SECRETS_BLOCK=""
if [[ "$ENABLE_SSO" == "true" ]]; then
  [[ -n "$PUBLIC_BASE_URL" ]] || die "ENABLE_SSO=true but PUBLIC_BASE_URL is empty and the Brev id could not be derived. Set PUBLIC_BASE_URL (and CONSOLE_URL) in .env."
  [[ -n "$CONSOLE_URL" ]] || die "ENABLE_SSO=true but CONSOLE_URL is empty and the Brev id could not be derived. Set CONSOLE_URL in .env."
  log "SSO enabled — site: ${PUBLIC_BASE_URL}   console: ${CONSOLE_URL}"
  if [[ "$PUBLIC_BASE_URL_EXPLICIT" == "0" && "$BREV_URL_DOMAIN_EXPLICIT" == "0" && "${BREV_URL_DOMAIN_DETECTED:-0}" == "0" ]]; then
    warn "No Brev links found in $BREV_CONTEXT; URLs use the default domain '${BREV_URL_DOMAIN}'."
    warn "If this box is served on another domain, set BREV_URL_DOMAIN (or PUBLIC_BASE_URL + CONSOLE_URL) and re-run."
  fi
  KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-$(gen)}"
  KC_DEMO_PASSWORD="${KC_DEMO_PASSWORD:-$(gen)}"
  KC_LEARNER_PASSWORD="${KC_LEARNER_PASSWORD:-$(gen)}"
  HEADLAMP_CLIENT_SECRET="${HEADLAMP_CLIENT_SECRET:-$(gen)}"
  GRAFANA_CLIENT_SECRET="${GRAFANA_CLIENT_SECRET:-$(gen)}"
  CONSOLE_CLIENT_SECRET="${CONSOLE_CLIENT_SECRET:-$(gen)}"
  # oauth2-proxy needs a 16, 24 or 32 byte cookie secret.
  CONSOLE_COOKIE_SECRET="${CONSOLE_COOKIE_SECRET:-$(openssl rand -hex 16)}"
  SSO_SECRETS_BLOCK="$(cat <<EOF

# --- SSO + ingress + console (ENABLE_SSO) ---
keycloak_enabled: true
apiserver_oidc_enabled: true
envoy_gateway_enabled: true
console_enabled: true
grafana_oidc_enabled: ${ENABLE_MONITORING}
headlamp_enabled: ${ENABLE_HEADLAMP}
keycloak_base_url: "${PUBLIC_BASE_URL}"
console_url: "${CONSOLE_URL}"
console_host_port: ${CONSOLE_HOST_PORT}
envoy_web_nodeport: ${ENVOY_WEB_NODEPORT}
envoy_grpc_nodeport: ${ENVOY_GRPC_NODEPORT}
keycloak_admin_password: "${KC_ADMIN_PASSWORD}"
keycloak_demo_user: "demo"
keycloak_demo_password: "${KC_DEMO_PASSWORD}"
keycloak_learner_user: "learner"
keycloak_learner_password: "${KC_LEARNER_PASSWORD}"
headlamp_client_secret: "${HEADLAMP_CLIENT_SECRET}"
grafana_client_secret: "${GRAFANA_CLIENT_SECRET}"
console_client_secret: "${CONSOLE_CLIENT_SECRET}"
console_cookie_secret: "${CONSOLE_COOKIE_SECRET}"
EOF
)"
fi

umask 077
cat > "$SECRETS_CACHE" <<EOF
# Generated by scripts/setup.sh — DO NOT COMMIT. Reused across runs.
KC_ADMIN_PASSWORD='${KC_ADMIN_PASSWORD:-}'
KC_DEMO_PASSWORD='${KC_DEMO_PASSWORD:-}'
KC_LEARNER_PASSWORD='${KC_LEARNER_PASSWORD:-}'
HEADLAMP_CLIENT_SECRET='${HEADLAMP_CLIENT_SECRET:-}'
GRAFANA_CLIENT_SECRET='${GRAFANA_CLIENT_SECRET:-}'
CONSOLE_CLIENT_SECRET='${CONSOLE_CLIENT_SECRET:-}'
CONSOLE_COOKIE_SECRET='${CONSOLE_COOKIE_SECRET:-}'
EOF
umask 022
[[ "$ENABLE_SSO" == "true" ]] && log "Keycloak users: demo (admin), learner (user); passwords in .sso-secrets.env"

# ---- host deps: Ansible -----------------------------------------------------
if ! command -v ansible-playbook >/dev/null 2>&1; then
  log "Installing Ansible + deps (apt)"
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  # --no-install-recommends: python3-pip recommends build-essential, whose
  # libc6-dev pulls a newer libc6, and upgrading libc6 re-executes systemd. That
  # cuts off Brev's wait on this setup (its badge then says "Failed" while setup
  # runs on). Nothing here needs a compiler.
  $SUDO apt-get install -y --no-install-recommends ansible python3 python3-pip curl git ca-certificates socat \
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
umask 077
cat > "$SECRETS" <<EOF
# Generated by scripts/setup.sh from .env — DO NOT COMMIT (contains the API key).
upstream_api_key: "${MODEL_API_KEY}"
upstream_base_url: "${MODEL_BASE_URL}"
litellm_models:
  - name: "${MODEL_NAME}"
    model: "${MODEL_NAME}"
inference_model: "${MODEL_NAME}"

# Single-VM launchable toggles (mirrors .env)
kyverno_enabled: ${ENABLE_KYVERNO}
monitoring_enabled: ${ENABLE_MONITORING}
sandboxes_enabled: ${CREATE_FLEET}
fleet_size: ${FLEET_SIZE}
gateway_nodeport: ${GATEWAY_NODEPORT}
${SSO_SECRETS_BLOCK}
EOF
umask 022

# ---- run the playbook -------------------------------------------------------
log "Running Ansible playbook (this pulls images and can take 15-25 min on first boot)"
TAGS_ARG=()
[[ -n "${ANSIBLE_TAGS:-}" ]] && TAGS_ARG=(--tags "$ANSIBLE_TAGS")

(
  cd "$ANSIBLE_DIR"
  ansible-playbook site.yml \
    -e @inventory/group_vars/secrets.yml \
    "${TAGS_ARG[@]}"
) || die "Ansible run failed — see the output above. Fix and re-run ./scripts/setup.sh"

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# ---- point the lab user's openshell CLI at the gateway ----------------------
# The playbook registers the gateway for root; the interactive lab shell (SSH
# and the in-browser terminal) runs as the box's primary user, which needs the
# same operator certificate bundle in its own ~/.config/openshell.
configure_lab_cli() {
  local u="$1"
  id "$u" >/dev/null 2>&1 || return 0
  local -a run
  if [[ "$(id -un)" == "$u" ]]; then run=(bash -c); else run=(sudo -u "$u" -H bash -c); fi
  "${run[@]}" "KUBECONFIG=/etc/rancher/k3s/k3s.yaml bash '$ROOT/scripts/lab-cli-setup.sh' fleet '${GATEWAY_NODEPORT}'" \
    || warn "Could not configure the openshell CLI for $u (re-run scripts/lab-cli-setup.sh as $u)"
}
LAB_USER="${LAB_USER:-$(stat -c '%U' "$ROOT" 2>/dev/null || echo ubuntu)}"
if command -v openshell >/dev/null 2>&1; then
  log "Pointing ${LAB_USER}'s openshell CLI at the gateway (mTLS operator, :${GATEWAY_NODEPORT})"
  configure_lab_cli "$LAB_USER"
  [[ "$(id -un)" != "$LAB_USER" ]] && configure_lab_cli "$(id -un)"
fi

# ---- host sockets for the Brev / launchpad Secure Links ---------------------
# A Secure Link reaches a real host socket, not a bare kube-proxy NodePort, and
# only low ports. socat forwards each low port to the Envoy ingress ClusterIP;
# Envoy routes by host name (site, Keycloak, Grafana / Console).
publish_envoy_sockets() {
  command -v socat >/dev/null 2>&1 || $SUDO apt-get install -y socat >/dev/null 2>&1 || true
  local cip
  cip=$(kubectl -n envoy-gateway-system get svc \
        -l gateway.envoyproxy.io/owning-gateway-name=fleet-gw \
        -o jsonpath="{.items[0].spec.clusterIP}" 2>/dev/null)
  [[ -n "$cip" ]] || { warn "Envoy data-plane ClusterIP not found — skipping socket forwarders."; return 0; }
  local name port
  for spec in "openshell-envoy-proxy:${ENVOY_HOST_PORT}" "openshell-console-proxy:${CONSOLE_HOST_PORT}"; do
    name="${spec%%:*}"; port="${spec##*:}"
    log "Forwarding host :${port} to the Envoy ingress (${cip}:80)"
    $SUDO tee "/etc/systemd/system/${name}.service" >/dev/null <<EOF
[Unit]
Description=Host :${port} to the Envoy ingress (Brev / launchpad Secure Link)
After=k3s.service network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/bin/socat -d TCP-LISTEN:${port},fork,reuseaddr,bind=0.0.0.0 TCP:${cip}:80
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable "$name" >/dev/null 2>&1 || true
    $SUDO systemctl restart "$name"
  done
}

# ---- training site (optional) ----------------------------------------------
# Next.js: lessons + a live in-browser terminal on this VM's cluster. Separate
# from the platform: a failure here never fails the provision.
deploy_training() {
  local site="$ROOT/training"
  [[ -d "$site" ]] || { warn "training/ not present — skipping the training site."; return 0; }

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]]; then
    log "Installing Node.js 22 (for the training site)"
    $SUDO install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | $SUDO tee /etc/apt/sources.list.d/nodesource.list >/dev/null
    $SUDO apt-get update -y >/dev/null
    # No build tools: the terminal uses a prebuilt pty (see the Ansible install
    # above for why upgrading libc6 during setup is avoided).
    $SUDO apt-get install -y --no-install-recommends nodejs python3
  fi

  log "Building the training site (npm ci + next build)"
  # --include=dev: tailwind/postcss/typescript are devDependencies needed at
  # build time, and the service runs with NODE_ENV=production.
  # Explicit checks: `set -e` does not apply inside a function called with `||`.
  ( cd "$site" && npm ci --include=dev --no-fund --no-audit && npm run build ) \
    || { warn "Training site build failed."; return 1; }

  local run_user; run_user="$(id -un)"
  log "Installing the openshell-training systemd service on port ${TRAINING_PORT}"
  # Re-point the Envoy upstream at the node's current InternalIP on every start
  # (the IP can change across a VM stop/start).
  $SUDO tee /usr/local/bin/openshell-training-endpoint.sh >/dev/null <<'HSH'
#!/usr/bin/env bash
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
kubectl get endpointslice training-host -n openshell >/dev/null 2>&1 || exit 0
ip="$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null)"
[ -n "$ip" ] || exit 0
kubectl patch endpointslice training-host -n openshell --type merge \
  -p "{\"endpoints\":[{\"addresses\":[\"$ip\"],\"conditions\":{\"ready\":true}}]}" >/dev/null 2>&1 || true
HSH
  $SUDO chmod +x /usr/local/bin/openshell-training-endpoint.sh
  # Replace the previous unit name if this box ran an older version.
  $SUDO systemctl disable --now openshell-workshop.service >/dev/null 2>&1 || true
  $SUDO rm -f /etc/systemd/system/openshell-workshop.service
  $SUDO tee /etc/systemd/system/openshell-training.service >/dev/null <<EOF
[Unit]
Description=OpenShell on Kubernetes training site (lessons + live shell)
After=network-online.target k3s.service
Wants=network-online.target

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${site}
Environment=NODE_ENV=production
Environment=PORT=${TRAINING_PORT}
Environment=HOST=0.0.0.0
Environment=KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=LAB_KUBECONFIG=/etc/rancher/k3s/k3s.yaml
Environment=LAB_CWD=${ROOT}
Environment=OPENSHELL_GATEWAY=fleet
Environment=PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
Environment=CONSOLE_URL=${CONSOLE_URL}
Environment=ENABLE_MONITORING=${ENABLE_MONITORING}
ExecStart=$(command -v node) ${site}/server.mjs
ExecStartPost=-/usr/local/bin/openshell-training-endpoint.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable openshell-training.service >/dev/null 2>&1 || true
  $SUDO systemctl restart openshell-training.service
  log "Training site running on port ${TRAINING_PORT}"

  # With SSO, serve the site through Envoy on the public host, so the site,
  # /auth and /grafana share one origin. The site runs on the host (systemd),
  # so a selector-less Service + EndpointSlice point Envoy at node:PORT.
  if [[ "${ENABLE_SSO}" == "true" ]]; then
    local node_ip
    node_ip="$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null)"
    [[ -n "${node_ip}" ]] || node_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    log "Routing the training site through Envoy (node ${node_ip}:${TRAINING_PORT})"
    kubectl -n openshell delete httproute workshop --ignore-not-found >/dev/null 2>&1 || true
    kubectl -n openshell delete svc workshop --ignore-not-found >/dev/null 2>&1 || true
    kubectl apply -f - <<YAML
apiVersion: v1
kind: Service
metadata: { name: training, namespace: openshell }
spec:
  ports: [{ name: http, port: 80, targetPort: ${TRAINING_PORT} }]
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: training-host
  namespace: openshell
  labels: { kubernetes.io/service-name: training }
addressType: IPv4
ports: [{ name: http, port: ${TRAINING_PORT} }]
endpoints: [{ addresses: ["${node_ip}"], conditions: { ready: true } }]
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: training, namespace: openshell }
spec:
  parentRefs: [{ name: fleet-gw, namespace: fleet-gateway, sectionName: web }]
  # No hostnames: a route that names a host wins over the host-less /auth and
  # /grafana routes for EVERY path on that host. Only the console names its host.
  rules:
    - matches: [{ path: { type: PathPrefix, value: / } }]
      # The Incident Lab streams a long NDJSON response; Envoy's default 15 s
      # route timeout would cut it.
      timeouts: { request: "0s" }
      filters:
        - type: RequestHeaderModifier
          requestHeaderModifier:
            set: [{ name: X-Forwarded-Proto, value: https }]
      backendRefs: [{ name: training, port: 80 }]
YAML
  fi
}

if [[ "${ENABLE_SSO}" == "true" && -z "${ANSIBLE_TAGS:-}" ]]; then
  publish_envoy_sockets
fi

if [[ "${ENABLE_TRAINING}" == "true" ]]; then
  # A targeted run (ANSIBLE_TAGS=...) leaves the running site untouched.
  if [[ -n "${ANSIBLE_TAGS:-}" ]]; then
    log "ANSIBLE_TAGS=${ANSIBLE_TAGS} set — skipping the training-site rebuild."
  else
    deploy_training || warn "Training site deploy failed (non-fatal) — the platform is up. See: journalctl -u openshell-training"
  fi
fi

# ---- access summary ---------------------------------------------------------
NODE_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
log "Done. OpenShell is running on Kubernetes (k3s) on this VM."
if [[ "${ENABLE_SSO}" == "true" ]]; then
  cat <<EOF

  Public URLs (Brev / launchpad Secure Links; each one forwards a host port):
    ${PUBLIC_BASE_URL}/          training site        (host port ${ENVOY_HOST_PORT})
    ${PUBLIC_BASE_URL}/grafana   Grafana              (same link)
    ${PUBLIC_BASE_URL}/auth      Keycloak             (same link)
    ${CONSOLE_URL}/              OpenShell Console    (host port ${CONSOLE_HOST_PORT})
  Sign in as demo (admin) or learner (user); passwords: grep KC_ .sso-secrets.env
EOF
elif [[ "${ENABLE_TRAINING}" == "true" ]]; then
  cat <<EOF

  Training site: http://${NODE_IP:-<vm-ip>}:${TRAINING_PORT}/   (expose port ${TRAINING_PORT})
EOF
fi
cat <<EOF

  Cluster
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    kubectl -n openshell get pods             # gateway, console
    kubectl get ns -l openshell.ai/workspace=true   # one namespace per workspace
    kubectl -n lab get pods                   # workspace "lab": sandboxes + supervisors

  OpenShell (the CLI is set up for $( [[ "$(id -un)" == "${LAB_USER}" ]] && echo "${LAB_USER}" || echo "$(id -un) and ${LAB_USER}") as the lab operator)
    openshell status
    openshell sandbox list
    openshell provider list                   # litellm: model access for sandboxes

  Agent
    openshell sandbox exec -n agent-0 -- pi --no-session -p "Write a haiku about Kubernetes pods"

  Models: agent -> LiteLLM (provider litellm, key injected by the supervisor) -> ${MODEL_BASE_URL}
          model ${MODEL_NAME} (alias "default")
EOF
echo
echo "  Re-run after editing .env:  ./scripts/setup.sh"
