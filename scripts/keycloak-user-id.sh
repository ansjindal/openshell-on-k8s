#!/usr/bin/env bash
# Print the OIDC subject (Keycloak user id) of a lab user, e.g. to add them to a
# workspace in the OpenShell Console:   scripts/keycloak-user-id.sh learner
# Uses Keycloak's admin CLI inside the Keycloak pod with the generated admin password.
set -euo pipefail
USER_NAME="${1:?usage: keycloak-user-id.sh <username>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
# shellcheck disable=SC1091
. "$ROOT/.sso-secrets.env"
kubectl -n keycloak exec deploy/keycloak -- /bin/bash -c '
  /opt/keycloak/bin/kcadm.sh config credentials --config /tmp/kcadm.config \
    --server http://localhost:8080/auth --realm master --user admin --password "$1" >/dev/null 2>&1 &&
  /opt/keycloak/bin/kcadm.sh get users --config /tmp/kcadm.config -r openshell -q exact=true -q username="$2" --fields id --format csv --noquotes' \
  _ "$KC_ADMIN_PASSWORD" "$USER_NAME"
