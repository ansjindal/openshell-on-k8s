#!/bin/bash
# =============================================================================
# Brev Launchable lifecycle wrapper — openshell-on-k8s.
#
# Paste this into the Brev "Setup script" field (Step 2). It is intentionally
# small (the 16 KiB-capped field only invokes the real logic, which lives in
# scripts/setup.sh in the repo).
#
# Brev's "Code source: GitHub Repo" ALREADY clones the repo onto the VM, so we
# LOCATE that clone rather than `git clone` again (a bare clone fails anyway:
# the field runs as a systemd oneshot whose CWD is the non-writable `/`).
#
# Then we capture the Launchable's Step 5 env-config vars into .env — without
# this they never reach setup.sh — run the provision, and tee the output.
#
# Robust by design: NO `set -e`. A permission-denied `find` (e.g. scanning
# /root) must not kill the script — that's what produced earlier "0 logs"
# failures on sibling launchables.
# =============================================================================
set -uo pipefail

echo "[brev-setup] locating repo..."
REPO="$(find "$HOME" /home /workspace . -maxdepth 5 -type d -name openshell-on-k8s 2>/dev/null | head -1 || true)"
if [ -z "${REPO:-}" ]; then
  echo "[brev-setup] ERROR: repo 'openshell-on-k8s' not found under \$HOME /home /workspace"
  ls -la "$HOME" || true
  exit 1
fi
cd "$REPO"
echo "[brev-setup] repo: $REPO"
chmod +x scripts/setup.sh scripts/fleet 2>/dev/null || true

# Capture the Launchable env-config vars into .env (only those actually set).
echo "[brev-setup] writing .env from Launchable env-config..."
: > .env
for v in OPENSHELL_API_KEY OPENSHELL_BASE_URL OPENSHELL_MODEL \
         ENABLE_GVISOR ENABLE_KYVERNO ENABLE_MONITORING \
         ENABLE_SSO ENABLE_HEADLAMP \
         PUBLIC_BASE_URL BREV_URL_PREFIX BREV_URL_DOMAIN \
         ENVOY_WEB_NODEPORT ENVOY_GRPC_NODEPORT ENVOY_HOST_PORT \
         CREATE_FLEET FLEET_SIZE AGENT_CMD \
         ENABLE_WORKSHOP WORKSHOP_PORT GATEWAY_NODEPORT ANSIBLE_TAGS; do
  if [ -n "${!v:-}" ]; then
    printf '%s=%q\n' "$v" "${!v}" >> .env
  fi
done
chmod 600 .env

echo "[brev-setup] running setup.sh (tee -> \$HOME/openshell-setup.log)..."
bash scripts/setup.sh 2>&1 | tee "$HOME/openshell-setup.log"
