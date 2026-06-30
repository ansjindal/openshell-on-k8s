# Ansible — OpenShell on Kubernetes install

> **Single VM?** You don't need this README — just run `../scripts/setup.sh`, which
> generates a localhost inventory and runs this playbook for you. The notes below are
> for driving a **multi-node** cluster from a workstation over SSH.

One playbook brings up the whole stack across your nodes, in order:

```
host prep:  01-gvisor (FIRST) → 02-mesh (conditional)
control:    03-k3s server → 03-k3s agents
cluster:    gVisor RuntimeClass → 04-agent_sandbox → 05-litellm → 06-postgres*
            → 07-keycloak* → 08-apiserver_oidc* → 09-openshell_gateway
            → 10-inference_routing → 11-kyverno* → 12-monitoring*
            → 13-headlamp* → 14-envoy_gateway* → 15-openshell_ui* → 16-sandboxes*
            (* optional / toggled)
```

Role folders are numbered in creation order (`roles/NN-name`).

## Prerequisites

- `ansible` (core) on your workstation (`pipx install ansible` or `brew install ansible`).
- SSH access to the nodes (host aliases in `~/.ssh/config` or IPs), passwordless sudo.
- An API key for your upstream OpenAI-compatible endpoint.

## Configure

```bash
cp inventory/hosts.ini.example inventory/hosts.ini          # your nodes (gitignored)
cp inventory/group_vars/secrets.example.yml inventory/group_vars/secrets.yml   # API key (gitignored)
```

- `inventory/hosts.ini` — `[server]` (control-plane) + `[agents]` (workers).
- `inventory/group_vars/all.yml` — public defaults: mesh iface, gVisor toggle, charts,
  the **multi-model** `litellm_models` list, component toggles.
- `inventory/group_vars/secrets.yml` — `upstream_api_key` and any environment-specific
  overrides (private `upstream_base_url`, custom `litellm_models`). Never committed.

## Run

```bash
cd ansible
ansible-playbook site.yml -e @inventory/group_vars/secrets.yml
```

Run a single layer with tags:

```bash
ansible-playbook site.yml --tags hostprep        # gvisor + mesh only
ansible-playbook site.yml --tags k3s
ansible-playbook site.yml --tags gateway
ansible-playbook site.yml --tags monitoring -e upstream_api_key=...
```

## Roles

| Role | Does | Where |
|---|---|---|
| `01-gvisor` | runsc + containerd drop-in (first); RuntimeClass post-k3s | all nodes |
| `02-mesh` | detect mesh IP, MSS clamp — **no-op if no mesh iface** | all nodes |
| `03-k3s` | server install / agent join, mesh-pinned | server + agents |
| `04-agent_sandbox` | upstream controller + CRDs | server |
| `05-litellm` | secret + official Helm chart (multi-model) | server |
| `06-postgres` | PostgreSQL (Bitnami) + DB secret — when `gateway_db_backend=postgres` | server |
| `07-keycloak` | OIDC identity provider (optional) | server |
| `08-apiserver_oidc` | kube-apiserver OIDC + RBAC (optional) | server |
| `09-openshell_gateway` | OpenShell gateway Helm chart (+gVisor / OIDC / Postgres overlays) | server |
| `10-inference_routing` | create `fleet` provider + point inference.local → LiteLLM (CLI) | server |
| `11-kyverno` | guardrails (+require-gvisor) | server |
| `12-monitoring` | kube-prometheus-stack + Loki + Alloy + dashboards | server |
| `13-headlamp` | Kubernetes dashboard, OIDC SSO (optional) | server |
| `14-envoy_gateway` | single-host path-routed ingress (optional) | server |
| `15-openshell_ui` | OpenShell Console web UI (optional) | server |
| `16-sandboxes` | create the initial sandbox fleet via the CLI — when `sandboxes_enabled` | server |

After it completes, drive the fleet with [`../scripts/fleet`](../scripts/fleet) (run it on the
server node, where kubectl + the openshell CLI are configured).
