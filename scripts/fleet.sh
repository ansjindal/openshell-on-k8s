#!/usr/bin/env bash
# fleet.sh: bring up the SRE copilot fleet (Module 4) from a simple spec, so the
# per-agent setup is never repeated by hand. Each line of the spec is:
#
#     name   tools          # sre-tools MCP tools the agent may call, comma-separated, or "-"
#
# e.g.   logs      loki_query
#        events    cluster_events,pod_status
#        analyst   -
#
# For each agent this creates a sandbox in the platform workspace (lab) whose
# policy allows only: a read-only clone of the skill repository, and the
# sre-tools MCP server for the agent's own tools (every other tool is refused,
# scale_deployment always). pi ships in the sandbox image, already pointed at
# LiteLLM; this adds the sre-tools MCP server to its mcp.json, clones the
# platform skills into ~/.agents/skills, and writes the agent's role to
# /sandbox/ROLE.md (from manifests/fleet/roles/<name>.md).
#
#   ./scripts/fleet.sh up fleet.txt | status | down [fleet.txt]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
export NO_COLOR=1
PROVIDER="${OPENSHELL_PROVIDER:-litellm}"
ROLES="$REPO/manifests/fleet/roles"
SKILL_REPO="http://gitea.skills.svc.cluster.local:3000/platform/skills.git"
MCP_URL="http://sre-tools.tools.svc.cluster.local:8080/mcp"
# The platform workspace (operator mode: namespace of the same name), unless set.
export OPENSHELL_WORKSPACE="${OPENSHELL_WORKSPACE:-lab}"
ox() { openshell sandbox exec -n "$1" -- sh -c "$2" </dev/null 2>&1 | grep -viE 'UNDICI|trace-warn' || true; }
b64() { base64 | tr -d '\n'; }

# The agent's whole network reach, as an OpenShell policy. Model access is not
# here: it comes from the attached litellm provider (_provider_litellm).
policy_for() {                       # $1 = tools, comma-separated, or "-"
  local tools="$1" mcp=""
  if [[ "$tools" != "-" && -n "$tools" ]]; then
    mcp="
  sre_tools:
    name: sre_tools
    endpoints:
      - host: sre-tools.tools.svc.cluster.local
        port: 8080
        path: /mcp
        protocol: mcp
        enforcement: enforce
        mcp: { versions: [\"2025-03-26\", \"2025-11-25\"] }
        rules:
          - allow: { method: initialize }
          - allow: { method: notifications/initialized }
          - allow: { method: tools/list }
          - allow: { method: tools/call, tool: { any: [${tools//,/, }] } }
        deny_rules:
          - { method: tools/call, tool: scale_deployment }
    binaries: [ {path: /usr/bin/node} ]"
  fi
  cat <<YAML
version: 1
filesystem_policy: { include_workdir: true, read_only: [/usr,/lib,/proc,/dev/urandom,/app,/etc,/var/log], read_write: [/sandbox,/tmp,/dev/null] }
landlock: { compatibility: best_effort }
process: { run_as_user: sandbox, run_as_group: sandbox }
network_policies:
  skill_repo:
    name: skill_repo
    endpoints:
      - host: gitea.skills.svc.cluster.local
        port: 3000
        protocol: rest
        enforcement: enforce
        rules:
          - allow: { method: GET, path: /platform/skills.git/info/refs }
          - allow: { method: POST, path: /platform/skills.git/git-upload-pack }
    binaries: [ {path: /usr/lib/git-core/git-remote-http} ]${mcp}
YAML
}

# Inside a Ready sandbox: pi's MCP config, the skills, the role. (pi and its
# LiteLLM config come with the image.)
configure() {                        # $1 = name, $2 = tools
  local name="$1" tools="$2"
  if [[ "$tools" != "-" && -n "$tools" ]]; then
    ox "$name" "mkdir -p ~/.pi/agent && printf '%s' '{\"mcpServers\":{\"sre-tools\":{\"url\":\"${MCP_URL}\"}}}' > ~/.pi/agent/mcp.json"
  fi
  ox "$name" "rm -rf /sandbox/skills && git clone -q ${SKILL_REPO} /sandbox/skills && mkdir -p ~/.agents/skills && for d in /sandbox/skills/*/; do ln -sfn \"\$d\" ~/.agents/skills/\$(basename \"\$d\"); done"
  [[ -f "$ROLES/$name.md" ]] && ox "$name" "echo $(b64 < "$ROLES/$name.md") | base64 -d > /sandbox/ROLE.md"
}

up() {
  local spec="${1:?usage: fleet.sh up <spec>}"
  local -a NM TL
  # Read the spec on FD 3: the openshell commands below read stdin.
  while read -r name tools <&3; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    NM+=("$name"); TL+=("${tools:--}")
  done 3< "$spec"
  echo "Bringing up ${#NM[@]} pi agents in workspace ${OPENSHELL_WORKSPACE}, in parallel:"
  local i name
  for i in "${!NM[@]}"; do
    name="${NM[$i]}"
    echo "▶ ${name}  (tools: ${TL[$i]})"
    policy_for "${TL[$i]}" > "/tmp/fleet-${name}.policy.yaml"
    openshell sandbox delete "$name" </dev/null >/dev/null 2>&1 || true
  done
  sleep 2
  # At most two creates at a time: the gateway validates each new sandbox's
  # policy before starting it, and five at once can outlast the CLI's timeout.
  create_one() {
    local n="$1" try
    for try in 1 2; do
      openshell sandbox create --name "$n" --policy "/tmp/fleet-${n}.policy.yaml" \
        --provider "$PROVIDER" --memory 2Gi --no-tty --detach -- sleep infinity </dev/null >"/tmp/fleet-${n}.log" 2>&1 && return 0
      openshell sandbox delete "$n" </dev/null >/dev/null 2>&1 || true
      sleep 3
    done
  }
  local running=0
  for i in "${!NM[@]}"; do
    create_one "${NM[$i]}" &
    running=$((running + 1))
    if (( running >= 2 )); then wait -n 2>/dev/null || true; running=$((running - 1)); fi
  done
  wait
  echo "   …waiting for each to be Ready, then configuring (MCP, skills, role) in parallel…"
  for i in "${!NM[@]}"; do
    (
      name="${NM[$i]}"; ready=false
      for j in $(seq 1 72); do
        openshell sandbox exec -n "$name" -- true </dev/null >/dev/null 2>&1 && { ready=true; break; }
        sleep 5
      done
      if [[ "$ready" != true ]]; then
        echo "   ✗ ${name} not ready:"; tail -4 "/tmp/fleet-${name}.log" 2>/dev/null | sed 's/^/       /'; exit 0
      fi
      configure "$name" "${TL[$i]}" >/dev/null
      echo "   ✓ ${name} ready: pi, $( [[ "${TL[$i]}" == "-" ]] && echo "no tools" || echo "tools ${TL[$i]}"), skills, role"
    ) &
  done
  wait
  echo "Done. Run './scripts/fleet.sh status', or open the Fleet page in the training site."
}

status() { openshell sandbox list 2>/dev/null | grep -viE 'UNDICI|trace-warn'; }
down()   { local s="${1:-}"; if [[ -n "$s" ]]; then awk '!/^#/ && NF{print $1}' "$s"; else openshell sandbox list 2>/dev/null | awk 'NR>1{print $1}'; fi | while read -r n; do [[ -n "$n" ]] && openshell sandbox delete "$n" >/dev/null 2>&1 && echo "removed $n"; done; }

case "${1:-}" in
  up) shift; up "$@" ;;
  status) status ;;
  down) shift; down "$@" ;;
  *) echo "usage: fleet.sh up <spec> | status | down [<spec>]"; exit 1 ;;
esac
