#!/usr/bin/env bash
# Point the calling user's openshell CLI at this VM's gateway as the lab operator.
#
#   scripts/lab-cli-setup.sh [gateway-name] [nodeport]
#
# The gateway (ansible/roles/09-openshell_gateway) trusts client certificates
# with OU=operator: cert-manager issues one into Secret openshell/openshell-operator-tls.
# This copies it into ~/.config/openshell/gateways/<name>/mtls/ and registers
# https://localhost:<nodeport> as an mTLS gateway. Idempotent.
set -euo pipefail

NAME="${1:-fleet}"
PORT="${2:-30808}"
NS="${OPENSHELL_NAMESPACE:-openshell}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
export PATH="/usr/local/bin:$HOME/.local/bin:$PATH"

command -v openshell >/dev/null || { echo "openshell CLI not installed" >&2; exit 1; }
command -v kubectl >/dev/null || { echo "kubectl not found" >&2; exit 1; }

dir="$HOME/.config/openshell/gateways/$NAME/mtls"
mkdir -p "$dir"
chmod 700 "$HOME/.config/openshell" "$HOME/.config/openshell/gateways" "$HOME/.config/openshell/gateways/$NAME" "$dir" 2>/dev/null || true

fetch() {  # fetch <key> -> stdout (decoded); fails when empty
  local v
  v="$(kubectl -n "$NS" get secret openshell-operator-tls -o jsonpath="{.data.${1//./\\.}}" 2>/dev/null || true)"
  [ -n "$v" ] || return 1
  printf '%s' "$v" | base64 -d
}

write_certs() {
  local i
  for i in $(seq 1 30); do
    if fetch tls.crt >"$dir/tls.crt.new" && fetch tls.key >"$dir/tls.key.new" && fetch ca.crt >"$dir/ca.crt.new" \
       && [ -s "$dir/tls.crt.new" ] && [ -s "$dir/tls.key.new" ] && [ -s "$dir/ca.crt.new" ]; then
      mv "$dir/tls.crt.new" "$dir/tls.crt"; mv "$dir/tls.key.new" "$dir/tls.key"; mv "$dir/ca.crt.new" "$dir/ca.crt"
      chmod 600 "$dir/tls.key"
      return 0
    fi
    sleep 4
  done
  echo "Secret $NS/openshell-operator-tls has no certificate yet" >&2
  return 1
}

write_certs
# `gateway add --local` requires the bundle to exist first. Re-registering an
# existing name is a no-op, so remove it first; then write the certs again in
# case `add` touched the directory.
openshell gateway remove "$NAME" >/dev/null 2>&1 || true
openshell gateway add "https://localhost:${PORT}" --local --name "$NAME" >/dev/null
write_certs
openshell gateway select "$NAME" >/dev/null 2>&1 || true

# Confirm: an operator is a platform admin.
for i in $(seq 1 10); do
  if openshell --gateway "$NAME" status >/dev/null 2>&1; then
    echo "openshell CLI for $(id -un): gateway '$NAME' at https://localhost:${PORT} (mTLS operator)"
    exit 0
  fi
  sleep 3
done
echo "gateway '$NAME' registered, but 'openshell status' does not answer yet" >&2
exit 1
