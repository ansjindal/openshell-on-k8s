# Brev Launchable — wizard mapping

How the fields in the Brev "Create Launchable" wizard map to this repo. The whole
stack runs on ONE VM: k3s + gVisor + the OpenShell gateway + an OpenClaw agent.

## Step 1 — Files & runtime

- **Code source:** this Git repo.
- **Runtime:** **VM mode**, Ubuntu 22.04 (this installs k3s natively on the host —
  no nested virtualization, no container-in-container, unlike the OpenShift/MicroShift
  variant). A plain GPU-less CPU VM is fine; inference is remote.

## Step 2 — Setup script

> **Do NOT paste `scripts/setup.sh` into this field.** The wizard field is capped at
> **16 KiB** and only accepts a `#!/bin/bash` shebang; `setup.sh` is ~20 KiB and uses
> `#!/usr/bin/env bash`. Keep the logic in the repo and paste the small lifecycle
> wrapper below (kept in the repo at [`setup-wrapper.sh`](setup-wrapper.sh)).

Set this repo as the Launchable's **Code source** so Brev clones it onto the VM, then
paste this into the Setup-script field:

```bash
#!/bin/bash
set -uo pipefail
REPO="$(find "$HOME" /home /workspace . -maxdepth 5 -type d -name openshell-on-k8s 2>/dev/null | head -1 || true)"
[ -n "${REPO:-}" ] || { echo "repo not found"; ls -la "$HOME"; exit 1; }
cd "$REPO"
chmod +x scripts/setup.sh scripts/fleet 2>/dev/null || true
: > .env
for v in OPENSHELL_API_KEY OPENSHELL_BASE_URL OPENSHELL_MODEL \
         ENABLE_GVISOR ENABLE_KYVERNO ENABLE_MONITORING ENABLE_SSO ENABLE_HEADLAMP \
         PUBLIC_BASE_URL BREV_URL_PREFIX BREV_URL_DOMAIN \
         ENVOY_WEB_NODEPORT ENVOY_GRPC_NODEPORT ENVOY_HOST_PORT \
         CREATE_FLEET FLEET_SIZE AGENT_CMD ENABLE_WORKSHOP WORKSHOP_PORT GATEWAY_NODEPORT ANSIBLE_TAGS; do
  [ -n "${!v:-}" ] && printf '%s=%q\n' "$v" "${!v}" >> .env
done
chmod 600 .env
bash scripts/setup.sh 2>&1 | tee "$HOME/openshell-setup.log"
```

Why it's shaped this way (each line earned from a real failure):
- **Locate, don't `git clone`.** Brev's Code source already clones the repo. A bare
  `git clone` runs from the oneshot's CWD (`/`, not writable by `ubuntu`) and dies with
  `could not create work tree dir … : Permission denied`.
- **Capture Step 5 vars into `.env`.** The env-config vars are present in the wrapper's
  environment but nothing reads them otherwise — the loop writes the set ones into `.env`,
  which `setup.sh` then sources. Without this, `OPENSHELL_API_KEY` never reaches the stack.
- **`set -uo pipefail`, no `-e`.** A permission-denied `find` (scanning `/root` etc.) must
  not abort the script — that produced "0 logs" failures elsewhere.
- **`tee` the log** to `$HOME/openshell-setup.log` for post-mortems.

`setup.sh` then installs Ansible, writes a localhost inventory, renders the Ansible
secrets from `.env`, and runs the playbook end-to-end. It is idempotent — safe to re-run
after editing `.env`.

## Step 3 — Networking (expose this port)

**With SSO on (default)** everything is path-routed through one Envoy host, so you expose
**one low port** (`3001`):

| Port    | What | Needed |
|---------|------|--------|
| `3001`  | Envoy ingress — `/` (teaching site) · `/console` · `/grafana` · `/auth` (Keycloak) | **expose this** (the single public host) |
| `3000`  | Teaching site directly (no SSO routing) — handy for local checks | optional |

> Expose `3001` as an **HTTP "Secure Link"**; the launchable runs a socat forwarder on this
> **low** host port → the in-cluster Envoy ingress. (NVIDIA launchpad only forwards low host
> ports — pointing a public URL at the high NodePort `30080` returns an edge **503**, which is
> why `3001` exists.) The public URL is auto-derived as
> `https://<BREV_URL_PREFIX>-<brevid>.<BREV_URL_DOMAIN>`.

**With SSO off**, expose `3000` (teaching site, incl. `/console`). Everything also works from
the VM terminal (`kubectl`, `openshell`, `./scripts/fleet`).

## Step 4 — Compute

- **GPU:** none (inference is a remote OpenAI-compatible endpoint).
- **CPU:** 8 vCPU recommended (min 4).
- **RAM:** 16 GB recommended (min 8).
- **Disk:** 40 GB+ (k3s + image pulls).

## Step 5 — Environment variables

Set these as the Launchable's environment configuration (or in `.env`):

| Variable | Purpose | Default |
|---|---|---|
| `OPENSHELL_API_KEY` | credential for the inference endpoint (**secret**) | — (required) |
| `OPENSHELL_BASE_URL` | OpenAI-compatible endpoint URL | `https://integrate.api.nvidia.com/v1` |
| `OPENSHELL_MODEL` | model id served by the endpoint | `meta/llama-3.3-70b-instruct` |
| `ENABLE_GVISOR` | runsc sandbox isolation | `true` |
| `ENABLE_KYVERNO` | policy guardrails (require-gvisor) | `true` |
| `ENABLE_MONITORING` | Prometheus + Grafana + Loki + Alloy + Tempo | `true` |
| `ENABLE_SSO` | Keycloak + apiserver-OIDC + Envoy ingress + Grafana/Console SSO (one public host) | `true` |
| `PUBLIC_BASE_URL` | public https host fronting Envoy via port `3001` (OIDC issuer); empty = auto-derive | `""` |
| `BREV_URL_PREFIX` / `BREV_URL_DOMAIN` | pieces of the auto-derived URL | `openshell` / `stg.apps.launchpad.nvidia.com` |
| `ENVOY_HOST_PORT` | **low** host port the public URL maps to (socat → Envoy) | `3001` |
| `CREATE_FLEET` | create an initial OpenClaw sandbox fleet | `true` |
| `FLEET_SIZE` | how many sandboxes | `1` |
| `ENABLE_WORKSHOP` | build + serve the teaching website (+ embedded `/console`) | `true` |
| `WORKSHOP_PORT` | port for the teaching site | `3000` |
| `ENVOY_WEB_NODEPORT` | in-cluster Envoy NodePort (internal; not the public port) | `30080` |
