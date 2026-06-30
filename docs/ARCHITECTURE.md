# Architecture & teaching points

A single Brev VM, one `./scripts/setup.sh`, and you have OpenShell running an agent on
Kubernetes. This doc explains what's underneath and what's worth pointing at when you
teach it.

## The flow

```
 you ──(openshell CLI / scripts/fleet)──▶ OpenShell gateway ──writes──▶ Sandbox CR
                                              (control plane)              │
                                                                          ▼
                                              agent-sandbox controller ──reconciles──▶ pod
                                                                          │  (RuntimeClass gvisor)
   agent code in the pod:                                                 ▼
     calls https://inference.local ──▶ in-sandbox policy proxy ──▶ LiteLLM ──▶ upstream model API
                                       (injects the credential)
```

1. **Install** — Ansible runs against this VM: gVisor → k3s → cluster components.
2. **Scale** — `scripts/fleet` / the `openshell` CLI talk gRPC to the gateway.
3. **Reconcile** — the gateway writes `agents.x-k8s.io` `Sandbox` CRs; the agent-sandbox
   controller turns each into a gVisor pod.
4. **Configure** — the gateway delivers policy + credentials + the inference route to each
   sandbox's supervisor (control plane only).
5. **Intercept** — agent code calls `https://inference.local`; the in-sandbox policy proxy
   intercepts it. The agent never holds the API key.
6. **Forward** — the proxy injects the gateway-provided credential and forwards to LiteLLM.
7. **Upstream** — LiteLLM fans out to the external model API.

## The components (Ansible roles)

| Role | What it teaches |
|---|---|
| `01-gvisor` | Why agents get a **kernel sandbox** (runsc), and how a RuntimeClass wires it into containerd. |
| `03-k3s` | A real, single-binary Kubernetes — the substrate everything else lands on. |
| `04-agent_sandbox` | The upstream **agent-sandbox** CRD/controller: sandboxes as first-class K8s objects. |
| `05-litellm` | One OpenAI-compatible endpoint in front of any model; central token metrics. |
| `09-openshell_gateway` | The **control plane**: a Kubernetes compute driver + inference router. |
| `10-inference_routing` | Wiring `inference.local` → LiteLLM (the one CLI-driven step). |
| `11-kyverno` | Policy-as-code guardrails — e.g. `require-gvisor` so nothing escapes the sandbox class. |
| `12-monitoring` | (optional) Prometheus + Grafana + Loki + Alloy — see the fleet and its token spend. |
| `16-sandboxes` | Declaratively create the initial agent fleet via the CLI. |

## The security story (the headline)

- **Kernel isolation** — every sandbox pod runs under gVisor (`runsc`), not the host kernel.
- **Credential isolation** — the agent calls `inference.local`; the supervisor's proxy holds
  and injects the real key. Compromised agent code cannot exfiltrate `OPENSHELL_API_KEY`.
- **Namespace isolation** — the gateway/control plane runs in `openshell`; agent sandbox pods
  run in a separate `openshell-sandboxes` namespace (the chart creates the sandbox SA/RBAC/
  NetworkPolicy there).
- **Policy enforcement** — Kyverno `require-gvisor` + sandbox guardrails make the isolation
  non-optional at admission time.

## Single sign-on & ingress (optional, `ENABLE_SSO`)

With SSO on, the launchable also deploys **Keycloak** (OIDC), patches the kube-apiserver for
OIDC RBAC, and fronts everything with an **Envoy Gateway** on one public host:
`/` + `/console` (the teaching site, which embeds the **OpenShell Console**), `/grafana`
(monitoring), and `/auth` (Keycloak). The OpenShell gateway itself stays in dev/unauthenticated
mode so it has no boot-time dependency on the issuer; Keycloak gates the browser UIs.

You expose **one low host port, `3001`** (`ENVOY_HOST_PORT`): a small socat forwarder bridges
`3001` → the in-cluster Envoy ingress. This matters on NVIDIA launchpad, which only forwards
**low** host ports — pointing a public URL straight at the high Envoy NodePort (`30080`) returns
an edge `503`. So `30080` stays internal and `3001` is the public socket.

## Running a different agent

OpenClaw is the default because it's the gateway's default `sandboxImage`
(`ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest`, set in
`ansible/roles/09-openshell_gateway/files/values.yaml`). To run a different agent:

- change `server.sandboxImage` in that values file to your sandbox image, **and**
- set `AGENT_CMD` in `.env` to the binary `scripts/fleet task` should invoke
  (`codex`/`opencode` for an OpenAI-format backend, `claude` for Anthropic-format).

The agent format must match the inference backend format — LiteLLM serves OpenAI-style, so
OpenAI-format agents work out of the box.

## Single-node vs multi-node

This launchable defaults to **single-node** (`mesh_iface: ""`, localhost inventory). The
same roles drive a multi-node mesh cluster from a workstation over SSH — see
[../ansible/README.md](../ansible/README.md).
