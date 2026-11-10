# Brev Launchable — wizard mapping

How the fields in the Brev "Create Launchable" wizard map to this repo. The whole
stack runs on ONE VM: k3s + the OpenShell gateway + Keycloak + the console + an OpenClaw agent.

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
         ENABLE_KYVERNO ENABLE_MONITORING ENABLE_SSO ENABLE_HEADLAMP \
         PUBLIC_BASE_URL CONSOLE_URL BREV_URL_PREFIX CONSOLE_URL_PREFIX BREV_URL_DOMAIN \
         ENVOY_WEB_NODEPORT ENVOY_GRPC_NODEPORT ENVOY_HOST_PORT CONSOLE_HOST_PORT \
         CREATE_FLEET FLEET_SIZE AGENT_CMD \
         ENABLE_OPENCLAW_UI OPENCLAW_UI_PORT OPENCLAW_UI_URL OPENCLAW_UI_URL_PREFIX \
         ENABLE_TRAINING TRAINING_PORT GATEWAY_NODEPORT ANSIBLE_TAGS; do
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

**With SSO on (default)** you create **two** Secure Links (three with the OpenClaw UI). Each
one is its own HTTPS subdomain on Brev, mapped to one low host port; a socat forwarder on each
port hands the traffic to the in-cluster Envoy ingress, which routes by host name:

| Secure Link name | Host port | Public URL | What |
|---|---|---|---|
| `openshell` | `3001` | `https://openshell-<brevid>.<domain>` | training site `/`, Keycloak `/auth`, Grafana `/grafana` |
| `console` | `3002` | `https://console-<brevid>.<domain>` | the OpenShell Console (sign in with Keycloak) |
| `openclaw` | `30789` | `https://openclaw-<brevid>.<domain>` | OpenClaw's own Control UI (optional, `ENABLE_OPENCLAW_UI=true`) |

The names matter: `scripts/setup.sh` derives the Keycloak issuer, the console's redirect URL
and the site's links from `https://<prefix>-<brevid>.<BREV_URL_DOMAIN>`, with prefixes
`BREV_URL_PREFIX` (`openshell`), `CONSOLE_URL_PREFIX` (`console`) and `OPENCLAW_UI_URL_PREFIX`
(`openclaw`). If your Brev links use a different domain (for example `gobrev.dev`), set
`BREV_URL_DOMAIN` before the first run; or set `PUBLIC_BASE_URL` and `CONSOLE_URL` directly.

> Brev/launchpad only forwards **low** host ports to real sockets: pointing a link at a high
> NodePort (`30080`) returns an edge **503**, which is why `3001` and `3002` exist.

**With SSO off**, expose `3000` (training site only; no console, no sign-in). Everything also
works from the VM terminal (`kubectl`, `openshell`, `./scripts/fleet`).

## Step 4 — Compute

- **GPU:** none (inference is a remote OpenAI-compatible endpoint).
- **CPU:** 8 vCPU (tested on GCP `n2d-standard-8`).
- **RAM:** 32 GB recommended (the full stack with monitoring uses about 12 GB before agents; one OpenClaw turn peaks near 2 GB).
- **Disk:** 60 GB+ (k3s + image pulls).
- **Kernel:** Linux 6.2+ with Landlock (Ubuntu 22.04 on GCP ships 6.8). OpenShell 0.1 sandboxes require Landlock ABI v3.

## Step 5 — Environment variables

Set these as the Launchable's environment configuration (or in `.env`):

| Variable | Purpose | Default |
|---|---|---|
| `OPENSHELL_API_KEY` | credential for the inference endpoint (**secret**) | — (required) |
| `OPENSHELL_BASE_URL` | OpenAI-compatible endpoint URL | `https://integrate.api.nvidia.com/v1` |
| `OPENSHELL_MODEL` | model id served by the endpoint | `meta/llama-3.3-70b-instruct` |
| `ENABLE_KYVERNO` | guardrails on sandbox pods (no host network/PID/IPC) | `true` |
| `ENABLE_MONITORING` | Prometheus + Grafana + Loki + Alloy + Tempo, OCSF audit export, agent trace relay | `true` |
| `ENABLE_SSO` | Keycloak + Envoy ingress + Grafana SSO + the OpenShell Console | `true` |
| `PUBLIC_BASE_URL` | public host of the site/Keycloak/Grafana (the OIDC issuer origin); empty = derive | `""` |
| `CONSOLE_URL` | public host of the console; empty = derive | `""` |
| `BREV_URL_PREFIX` / `CONSOLE_URL_PREFIX` / `BREV_URL_DOMAIN` | pieces of the derived URLs | `openshell` / `console` / `brevlab.com` |
| `ENVOY_HOST_PORT` / `CONSOLE_HOST_PORT` | low host ports the two links map to | `3001` / `3002` |
| `CREATE_FLEET` | create agent-0..N-1 (baseline policy + `litellm` provider) | `true` |
| `FLEET_SIZE` | how many sandboxes | `1` |
| `ENABLE_TRAINING` | build + serve the training site | `true` |
| `TRAINING_PORT` | port of the training site on the VM | `3000` |
| `ENVOY_WEB_NODEPORT` | in-cluster Envoy NodePort (internal; not the public port) | `30080` |
| `ENABLE_OPENCLAW_UI` | forward OpenClaw's own web UI from agent-0 to a host port | `true` |
| `OPENCLAW_UI_PORT` | host port OpenClaw's UI is forwarded to, if enabled | `30789` |
