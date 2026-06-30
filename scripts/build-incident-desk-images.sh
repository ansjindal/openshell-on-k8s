#!/usr/bin/env bash
# =============================================================================
# Build + import the two :local images the Incident Desk deploys reference.
#
# Both deploys use imagePullPolicy: Never, so the images MUST exist in the k3s
# containerd image store (namespace k8s.io) before their pods schedule. This
# script builds them with docker and imports the resulting tarballs into k3s.
#
# Images:
#   incident-desk/research-desk-backend:local  (backend; build context = REPO ROOT)
#   incident-desk/orders-api:local             (used by BOTH orders-api + catalog-api)
#
# Idempotent: skips build+import for any image already present in
# `k3s ctr -n k8s.io images ls`. Force a rebuild with FORCE_REBUILD=true.
# Safe to re-run.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# sudo only if we're not already root (k3s ctr needs root).
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || die "Need root or sudo to import images into k3s containerd."
  SUDO="sudo"
fi

FORCE_REBUILD="${FORCE_REBUILD:-false}"

command -v docker >/dev/null 2>&1 || die "docker is required to build the Incident Desk images."

# `k3s ctr` is shipped by the k3s install; fall back to the binary path if not on PATH.
if command -v k3s >/dev/null 2>&1; then
  CTR=($SUDO k3s ctr -n k8s.io)
elif [[ -x /usr/local/bin/k3s ]]; then
  CTR=($SUDO /usr/local/bin/k3s ctr -n k8s.io)
else
  die "k3s not found — cannot import images into the cluster image store."
fi

# True if the given image ref is already in the k3s k8s.io image store.
image_present() {
  "${CTR[@]}" images ls -q 2>/dev/null | grep -qx "docker.io/$1" \
    || "${CTR[@]}" images ls 2>/dev/null | awk '{print $1}' | grep -qx "$1" \
    || "${CTR[@]}" images ls 2>/dev/null | awk '{print $1}' | grep -qx "docker.io/$1"
}

# build <image-ref> <build-cmd...>  — skip when already present (unless FORCE_REBUILD).
build_and_import() {
  local img="$1"; shift
  if [[ "$FORCE_REBUILD" != "true" ]] && image_present "$img"; then
    log "Image ${img} already in the k3s image store — skipping build (FORCE_REBUILD=true to rebuild)."
    return 0
  fi
  log "Building ${img}"
  ( cd "$ROOT" && "$@" )
  log "Importing ${img} into k3s containerd (k8s.io namespace)"
  docker save "$img" | "${CTR[@]}" images import -
  log "Imported ${img}."
}

# Backend — context is the REPO ROOT (Dockerfile COPYs backend/ + catalog/).
build_and_import "incident-desk/research-desk-backend:local" \
  docker build -f incident-desk/backend/Dockerfile -t incident-desk/research-desk-backend:local .

# orders-api — context is the demo-shop app dir. Reused by orders-api + catalog-api.
build_and_import "incident-desk/orders-api:local" \
  docker build -t incident-desk/orders-api:local incident-desk/demo-shop/app/

log "Incident Desk images ready (research-desk-backend:local, orders-api:local)."
