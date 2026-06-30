#!/usr/bin/env bash
# openclaw-ui-supervise.sh — keep the standalone OpenClaw Control UI alive.
#
# The Control UI (the /openclaw route behind Envoy) is served by an OpenClaw gateway
# running INSIDE the `openclaw-ui` OpenShell fleet sandbox, exposed to the host via an
# `openshell forward` ssh-bridge that binds the node IP at :OPENCLAW_UI_PORT. A
# selector-less Service + manual Endpoints (pinned to the NODE IP) point the /openclaw
# HTTPRoute at that host socket.
#
# Two things are inherently un-supervised and so die on a process crash / node reboot:
#   1. the in-sandbox gateway — a `nohup`'d process inside the sandbox, and
#   2. the host forward — an `openshell forward` ssh-bridge process on the host.
# When either dies, /openclaw goes dead. This script is the supervisor: it is meant to
# run as the FOREGROUND process of the `openclaw-ui.service` systemd unit (Restart=always),
# so systemd owns it and restarts the whole thing if the script itself ever exits.
#
# Reconcile loop (every OPENCLAW_UI_INTERVAL seconds):
#   a) ensure the `openclaw-ui` sandbox is Ready (exec `true`);
#   b) ensure the in-sandbox gateway is listening (in-sandbox curl 127.0.0.1:PORT);
#      if not, (re)launch it with the same command the web /api/devices route uses;
#   c) ensure the host forward bridge is up (node :PORT LISTEN); if not, (re)start
#      `openshell forward start` in the BACKGROUND and let the loop keep watching it.
#
# The forward is run in the background (not foreground-blocking) so the same loop can also
# self-heal the in-sandbox gateway — a gateway death wouldn't kill the forward, so a
# foreground-on-forward design would never notice it.
#
# Config comes from the environment (the systemd unit sets it; defaults match the live box):
#   OPENCLAW_UI_SANDBOX   sandbox name              (default openclaw-ui)
#   OPENCLAW_UI_GATEWAY   openshell named gateway   (default fleet)
#   OPENCLAW_UI_PORT      gateway / bridge port     (default 18789)
#   OPENCLAW_UI_PASSWORD  gateway auth+remote pw    (default openclaw-ui-ctl)  [config, not a secret-of-record]
#   OPENCLAW_UI_BIND      host bind addr            (default 0.0.0.0)
#   OPENCLAW_UI_INTERVAL  reconcile period seconds  (default 15)
set -uo pipefail

SANDBOX="${OPENCLAW_UI_SANDBOX:-openclaw-ui}"
GATEWAY="${OPENCLAW_UI_GATEWAY:-fleet}"
PORT="${OPENCLAW_UI_PORT:-18789}"
PASSWORD="${OPENCLAW_UI_PASSWORD:-openclaw-ui-ctl}"
BIND="${OPENCLAW_UI_BIND:-0.0.0.0}"
INTERVAL="${OPENCLAW_UI_INTERVAL:-15}"

log() { echo "[openclaw-ui-supervise] $*"; }

# Drop the host gateway-endpoint vars so the openshell CLI uses the NAMED gateway
# (--gateway fleet) rather than any default endpoint — same trick the web app uses.
unset OPENSHELL_GATEWAY_ENDPOINT OPENSHELL_GATEWAY_TLS 2>/dev/null || true

# Strip the noisy node/ssh warnings that openshell emits so the journal stays readable.
filt() { grep -viE 'UNDICI|trace-warn|warning: perman|Pseudo-term' || true; }

FWD_PID=""

# (a) Is the sandbox Ready? `sandbox exec -- true` returns 0 only when it's up.
sandbox_ready() {
  openshell --gateway "$GATEWAY" sandbox exec -n "$SANDBOX" -- true </dev/null >/dev/null 2>&1
}

# (b) Is the in-sandbox gateway listening? curl the loopback inside the sandbox.
gateway_up() {
  local code
  code="$(openshell --gateway "$GATEWAY" sandbox exec -n "$SANDBOX" -- \
    sh -c "curl -fsS -o /dev/null -w '%{http_code}' 127.0.0.1:${PORT}/ 2>/dev/null" \
    </dev/null 2>/dev/null | filt | tr -dc '0-9')"
  [ "$code" = "200" ]
}

# (b') (Re)launch the in-sandbox gateway. Same command as web/src/app/api/devices/route.ts:
# foreground `exec` inside a nohup so it reparents to the sandbox init and survives the
# exec session; write a fresh /sandbox/gw.log.
start_gateway() {
  log "starting in-sandbox gateway on :${PORT}"
  openshell --gateway "$GATEWAY" sandbox exec -n "$SANDBOX" -- sh -c \
    "cd /sandbox && nohup openclaw gateway run --port ${PORT} --bind lan --auth password --password '${PASSWORD}' --allow-unconfigured >/sandbox/gw.log 2>&1 &" \
    </dev/null >/dev/null 2>&1 | filt || true
}

# (c) Is the host forward bridge up? The node port shows a LISTEN socket when bound.
forward_up() {
  ss -ltn 2>/dev/null | grep -q ":${PORT} "
}

# (c') (Re)start the host forward in the BACKGROUND; track its PID so we can tell if it died.
start_forward() {
  log "starting host forward bridge ${BIND}:${PORT} -> ${SANDBOX}"
  # Reap any previous child we launched that has exited.
  [ -n "$FWD_PID" ] && ! kill -0 "$FWD_PID" 2>/dev/null && FWD_PID=""
  openshell --gateway "$GATEWAY" forward start "${BIND}:${PORT}" "$SANDBOX" \
    </dev/null >/dev/null 2>&1 &
  FWD_PID=$!
}

cleanup() {
  [ -n "$FWD_PID" ] && kill "$FWD_PID" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

log "supervising sandbox=${SANDBOX} gateway=${GATEWAY} port=${PORT} bind=${BIND} interval=${INTERVAL}s"

while true; do
  if sandbox_ready; then
    gateway_up   || start_gateway
    # Re-establish the bridge if the port isn't listening OR the child we launched has died.
    if ! forward_up || { [ -n "$FWD_PID" ] && ! kill -0 "$FWD_PID" 2>/dev/null; }; then
      start_forward
    fi
  else
    log "sandbox ${SANDBOX} not Ready yet — waiting (role 18 / the desk deploy provisions it)"
  fi
  sleep "$INTERVAL"
done
