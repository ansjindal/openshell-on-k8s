#!/usr/bin/env bash
# =============================================================================
# Seed the Incident Desk GitOps catalog into in-cluster Gitea + register the
# ArgoCD app, so a fresh launch comes up with the catalog-api incident already
# live (CrashLoopBackOff from the FAULT config.env), ready for the agent fleet
# to investigate + open the remediation PR.
#
# Idempotent: skips the Gitea seed if apps/catalog/config.env already exists on
# the repo's `main`, and `kubectl apply` of the ArgoCD Application is a no-op if
# unchanged. Safe to re-run.
#
# Prerequisites (NOT created here — currently provisioned manually with the rest
# of the Incident Desk):
#   - Gitea up (svc gitea.gitea:3000) with the `gitops` org + `incident-gitops` repo
#   - Secret `gitea-token` (key `token`) in namespace `research-desk`
#   - ArgoCD up in namespace `argocd`
# If any prerequisite is missing this script logs and exits 0 (non-fatal).
#
# Gitea Contents API note: this Gitea version requires POST (not PUT) to CREATE a
# new file:  POST /api/v1/repos/<owner>/<repo>/contents/<path>
# auth header:  Authorization: token <token>
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
GITOPS_DIR="$ROOT/incident-desk/deploy/gitops"

log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
KC=(kubectl)

# ---- config -----------------------------------------------------------------
GITEA_API="${GITEA_API:-http://gitea.gitea.svc.cluster.local:3000/api/v1}"
GITEA_OWNER="${GITEA_OWNER:-gitops}"
GITEA_REPO="${GITEA_REPO:-incident-gitops}"
GITEA_BRANCH="${GITEA_BRANCH:-main}"
GITEA_TOKEN_NS="${GITEA_TOKEN_NS:-research-desk}"
GITEA_TOKEN_SECRET="${GITEA_TOKEN_SECRET:-gitea-token}"
CURL_IMAGE="${CURL_IMAGE:-curlimages/curl:8.10.1}"

# ---- prereqs ----------------------------------------------------------------
"${KC[@]}" get ns gitea            >/dev/null 2>&1 || { warn "Gitea namespace absent — skipping GitOps catalog seed."; exit 0; }
"${KC[@]}" get ns argocd           >/dev/null 2>&1 || { warn "ArgoCD namespace absent — skipping GitOps catalog seed."; exit 0; }

TOKEN="$("${KC[@]}" -n "$GITEA_TOKEN_NS" get secret "$GITEA_TOKEN_SECRET" -o jsonpath='{.data.token}' 2>/dev/null | base64 -d || true)"
[[ -n "$TOKEN" ]] || { warn "Secret ${GITEA_TOKEN_SECRET} in ns ${GITEA_TOKEN_NS} not found — skipping GitOps catalog seed."; exit 0; }

# curl helper — run inside the cluster network (the Gitea svc DNS is cluster-internal).
# Pass the curl args after the image; capture combined output, strip the "pod deleted" line.
gcurl() {
  "${KC[@]}" run "gitea-seed-$$-${RANDOM}" --rm -i --restart=Never --image="$CURL_IMAGE" --quiet -- "$@" \
    2>/dev/null | sed '/pod ".*" deleted/d'
}

# ---- (a) ensure the repo exists ---------------------------------------------
repo_code="$(gcurl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: token ${TOKEN}" "${GITEA_API}/repos/${GITEA_OWNER}/${GITEA_REPO}")"
if [[ "$repo_code" != "200" ]]; then
  log "Repo ${GITEA_OWNER}/${GITEA_REPO} not found (HTTP ${repo_code}) — creating it under the org."
  gcurl -s -o /dev/null -w 'create-repo=%{http_code}\n' \
    -X POST -H "Authorization: token ${TOKEN}" -H 'Content-Type: application/json' \
    -d "{\"name\":\"${GITEA_REPO}\",\"private\":false,\"auto_init\":true,\"default_branch\":\"${GITEA_BRANCH}\"}" \
    "${GITEA_API}/orgs/${GITEA_OWNER}/repos" || warn "org-repo create failed; the org may need to exist first."
else
  log "Repo ${GITEA_OWNER}/${GITEA_REPO} present."
fi

# ---- (b) seed apps/catalog/ (idempotent) ------------------------------------
cfg_code="$(gcurl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: token ${TOKEN}" \
  "${GITEA_API}/repos/${GITEA_OWNER}/${GITEA_REPO}/contents/apps/catalog/config.env?ref=${GITEA_BRANCH}")"
if [[ "$cfg_code" == "200" ]]; then
  log "apps/catalog/config.env already on ${GITEA_BRANCH} — Gitea seed already done (skipping)."
else
  log "Seeding apps/catalog/ from ${GITOPS_DIR}/catalog/ into ${GITEA_OWNER}/${GITEA_REPO}@${GITEA_BRANCH} (FAULT config)."
  for f in config.env kustomization.yaml catalog-api.yaml; do
    src="${GITOPS_DIR}/catalog/${f}"
    [[ -f "$src" ]] || { warn "missing source ${src} — skipping ${f}."; continue; }
    b64="$(base64 < "$src" | tr -d '\n')"
    code="$(gcurl -s -o /dev/null -w '%{http_code}' \
      -X POST -H "Authorization: token ${TOKEN}" -H 'Content-Type: application/json' \
      -d "{\"branch\":\"${GITEA_BRANCH}\",\"message\":\"seed apps/catalog/${f}\",\"content\":\"${b64}\"}" \
      "${GITEA_API}/repos/${GITEA_OWNER}/${GITEA_REPO}/contents/apps/catalog/${f}")"
    log "  POST apps/catalog/${f} -> HTTP ${code}"
  done
fi

# ---- (c) register the ArgoCD Application ------------------------------------
log "Applying the ArgoCD catalog Application."
"${KC[@]}" apply -f "${GITOPS_DIR}/argocd-catalog-app.yaml"

log "GitOps catalog seed complete (repo: ${GITEA_OWNER}/${GITEA_REPO}, ArgoCD app: catalog)."
