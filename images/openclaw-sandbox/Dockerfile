# Custom OpenClaw sandbox image = the community sandbox image + a newer OpenClaw.
#
# Why: the community base image ships whatever OpenClaw was current when it was built,
# which can lag the npm release — pinning our own tag lets us track a specific, tested
# OpenClaw version independent of the base image's release cadence. Verified live
# (2026-09): the community :latest base was still on OpenClaw 2026.3.11 / Node 22.22.1.
#
# OpenClaw >=2026.8.x requires Node >=22.22.3 — newer than the base image's Node, so this
# also bumps Node itself (via `n`) before installing OpenClaw.
#
# Build + publish via .github/workflows/build-openclaw-sandbox.yml (pushes to
# ghcr.io/<owner>/openclaw-sandbox:<version>), then pin openshell_sandbox_image /
# ansible/roles/09-openshell_gateway/files/values.yaml's sandboxImage to it.
ARG BASE=ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest
FROM ${BASE}

ARG OPENCLAW_VERSION=2026.8.2
ARG NODE_VERSION=22.22.3

USER root
RUN npm install -g n \
 && n "${NODE_VERSION}" \
 && hash -r \
 && npm install -g "openclaw@${OPENCLAW_VERSION}" \
 && node --version \
 && openclaw --version
