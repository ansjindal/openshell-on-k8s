# OpenShell on Kubernetes — a Brev Launchable

Stand up **[NVIDIA OpenShell](https://docs.nvidia.com/openshell/)** on a real Kubernetes
cluster and run an **agent** (OpenClaw by default) inside an isolated, policy-controlled
sandbox — on a **single VM**, with **one command**.

It's a teaching launchable: learn, hands-on, what it takes to run agents on Kubernetes the
OpenShell way — a control-plane gateway, sandboxes as native pods, **gVisor** kernel
isolation, and an inference path where **the agent never holds the API key**. It ships a
**teaching website** (lessons + a live in-browser terminal + an embedded **OpenShell
Console**), optional **single sign-on** (Keycloak) and **observability** (Prometheus +
Grafana + Loki + Alloy + Tempo), all reachable through **one public URL**.

> Plain upstream Kubernetes (**k3s**) — no nesting, no MicroShift, no `oc`. The repeatable
> infra is Ansible, on a single node.

## Architecture

![OpenShell-on-Kubernetes architecture: a browser reaches one public host (Envoy ingress :3001) fronting the teaching site/console, Grafana, and Keycloak SSO; the gateway in the openshell namespace writes a Sandbox CR that the agent-sandbox controller reconciles into a gVisor-isolated OpenClaw agent pod in openshell-sandboxes (Kyverno enforces gVisor); the agent calls https://inference.local, and the in-pod supervisor proxy injects the key and forwards to LiteLLM then the upstream model API.](docs/architecture.png)

<!-- Source for the diagram above: docs/architecture.mmd (Mermaid). Re-render with:
     npx -y @mermaid-js/mermaid-cli -i docs/architecture.mmd -o docs/architecture.png -t neutral -b white --scale 3
     Committed as a PNG because the Brev Launchable README viewer does not render Mermaid. -->
**Architecture** — one public host (Envoy ingress on `:3001`) fronts the site/console, Grafana, and Keycloak; the gateway writes a Sandbox CR, the controller reconciles a gVisor-isolated agent pod, and the agent's `https://inference.local` is proxied (key injected) to LiteLLM → your model API.

**Credential isolation:** agent code calls `https://inference.local`; the in-pod supervisor
proxy holds the gateway-provided key and forwards to LiteLLM → your model API. A compromised
agent never sees `OPENSHELL_API_KEY`. **Namespace isolation:** the gateway runs in `openshell`,
agent pods in `openshell-sandboxes`. **Kernel isolation:** every sandbox pod runs under the
`gvisor` RuntimeClass, enforced at admission by Kyverno.

## Quick start (on the VM)

```bash
cp .env.example .env
$EDITOR .env            # set OPENSHELL_API_KEY (build.nvidia.com, OpenAI, vLLM/NIM…)
./scripts/setup.sh      # installs Ansible, brings up the whole stack (~10-20 min first boot)
```

`setup.sh` installs Ansible, writes a localhost inventory + a secrets file from `.env`, runs
the playbook, builds & serves the teaching site, and — when SSO is on — publishes everything
through Envoy on a single port. It's **idempotent**: re-run after editing `.env`, or target one
layer with `ANSIBLE_TAGS=gateway ./scripts/setup.sh`.

### Reach it

When SSO is enabled (default), **expose only port `3001`** on your platform and everything
lives under one host (auto-derived on Brev/launchpad as `https://<prefix>-<brevid>.<domain>`).
`3001` is a **low host port** the launchpad edge will forward — a socat forwarder bridges it to
the in-cluster Envoy ingress (pointing a public URL straight at the high NodePort `30080`
returns an edge 503, since launchpad only forwards low ports):

| Path | What | Auth |
|------|------|------|
| `/` | Teaching site — lessons + live terminal | launchpad/public |
| `/console` | **OpenShell Console** — fleet & sandbox management | Keycloak |
| `/grafana` | Dashboards & metrics | Keycloak |
| `/auth` | Keycloak (realm `openshell`) | — |

Or drive it straight from the VM:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl -n openshell get pods            # gateway, LiteLLM
kubectl -n openshell-sandboxes get pods  # agent sandboxes

./scripts/fleet status                                       # sandboxes + readiness
./scripts/fleet task "Write a haiku about Kubernetes pods" all
./scripts/fleet shell agent-0
```

## What it deploys

| Component | Namespace | Notes |
|---|---|---|
| **k3s** | — | single-node Kubernetes, pinned `v1.35.5` (newer minors break the supervisor bootstrap) |
| **gVisor** (`runsc`) | — | RuntimeClass every sandbox pod runs under |
| **agent-sandbox controller** | `agent-sandbox-system` | pinned `v0.5.0`; reconciles `Sandbox` CRs → pods |
| **LiteLLM** | `litellm` | one OpenAI-compatible endpoint in front of the model |
| **OpenShell gateway** | `openshell` | control plane: creates sandboxes, routes `inference.local` |
| **OpenClaw sandboxes** | `openshell-sandboxes` | the agents, as native gVisor pods |
| **Kyverno** | `kyverno` | guardrails — `require-gvisor` + sandbox policies |
| **Monitoring** | `monitoring` | Prometheus + Grafana + Loki + Alloy + Tempo *(toggle)* |
| **Keycloak + Envoy** | `keycloak` / `envoy-gateway-system` | SSO + single-host path-routed ingress *(toggle)* |
| **Teaching site + Console** | host (systemd) | Next.js: lessons, live terminal, `/console` |

## Configuration

Everything is driven by `.env` (see [.env.example](.env.example)):

- `OPENSHELL_API_KEY` / `OPENSHELL_BASE_URL` / `OPENSHELL_MODEL` — the inference backend.
- `ENABLE_GVISOR`, `ENABLE_KYVERNO`, `ENABLE_MONITORING` — stack toggles.
- `ENABLE_SSO` — Keycloak + apiserver-OIDC + Envoy ingress + Grafana/Console SSO under one host.
- `PUBLIC_BASE_URL` / `BREV_URL_PREFIX` / `BREV_URL_DOMAIN` — the public host (auto-derived per instance when empty).
- `CREATE_FLEET`, `FLEET_SIZE`, `AGENT_CMD` — the initial agent fleet.

Running **other agents** instead of OpenClaw: the gateway's `sandboxImage` and the `AGENT_CMD`
your tasks invoke are both configurable. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Layout

```
scripts/setup.sh         # entrypoint — single-VM bring-up (+ Envoy real-socket forwarder)
scripts/fleet            # runtime ops: up / down / status / task / shell / logs
.env.example             # config (model, key, toggles) — copy to .env
brev/launchable.md       # Brev wizard field-by-field mapping
ansible/                 # the repeatable infra (16 roles; single-node by default)
  site.yml               #   ordered plays
  inventory/group_vars/all.yml   # public defaults (charts, versions, toggles)
  roles/                 #   01-gvisor … 16-sandboxes
web/                     # teaching website (Next.js + xterm.js + embedded console)
docs/ARCHITECTURE.md     # the flow, the security model, the teaching points
```

## Multi-node

The same Ansible drives a real multi-node cluster from a workstation over SSH — fill in
`ansible/inventory/hosts.ini`, set `mesh_iface` if your nodes use a mesh NIC, and run the
playbook directly. See [ansible/README.md](ansible/README.md).

## License

Apache-2.0 — see [LICENSE](LICENSE). Built on
[NVIDIA OpenShell](https://docs.nvidia.com/openshell/),
[kubernetes-sigs/agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox),
[LiteLLM](https://github.com/BerriAI/litellm), [k3s](https://k3s.io), gVisor, Kyverno,
Keycloak, and Envoy Gateway.
