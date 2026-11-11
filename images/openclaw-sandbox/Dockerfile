# OpenClaw sandbox image for OpenShell 0.1.x: the OpenShell community base image
# plus a pinned OpenClaw, wired to the lab's LiteLLM model gateway.
#
#   - Base: openshell-community/sandboxes/base, pinned by digest (runs as `sandbox`).
#   - OpenClaw needs Node >= 24.16; the base ships Node 22, so a checksum-verified
#     Node 24 goes under /usr/local/lib/openclaw and only OpenClaw uses it.
#   - /etc/openshell/policy.yaml: the base image's copy is not valid for 0.1.x,
#     so it is replaced with the lab baseline (deny all network; model access
#     comes from the `litellm` provider attached to the sandbox).
#
# Built and published by .github/workflows/build-openclaw-sandbox.yml as
# ghcr.io/<owner>/openclaw-sandbox:<OPENCLAW_VERSION>; the gateway's default
# sandbox image (sandbox_image_tag in ansible/inventory/group_vars/all.yml) pins it.
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:fffb6b2@sha256:aeef1c63f00e2913ea002ccb3aaf925f338b5c5d70e63576f0d95c16a138044e

ARG OPENCLAW_VERSION=2026.11.3
ARG NODE_VERSION=24.22.2
ARG NODE_SHA256=48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Everything under /usr/local (readable under the baseline Landlock policy).
RUN set -eux; \
    curl -fsSL --retry 3 -o /tmp/node.tar.xz \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"; \
    echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c -; \
    mkdir -p /usr/local/lib/openclaw/node; \
    tar -xJf /tmp/node.tar.xz -C /usr/local/lib/openclaw/node --strip-components=1 \
      --exclude='*/include' --exclude='*/share' --exclude='*/lib/node_modules/corepack'; \
    rm /tmp/node.tar.xz; \
    PATH=/usr/local/lib/openclaw/node/bin:$PATH \
      npm install --global --prefix /usr/local/lib/openclaw \
        --cache /tmp/npm-cache --no-audit --no-fund --omit=dev \
        "openclaw@${OPENCLAW_VERSION}"; \
    rm -rf /tmp/npm-cache /root/.npm; \
    test "$(/usr/local/lib/openclaw/node/bin/node -p "require('/usr/local/lib/openclaw/lib/node_modules/openclaw/package.json').version")" = "${OPENCLAW_VERSION}"

RUN install -d -m 0755 /etc/openclaw
COPY --chmod=0755 openclaw /usr/local/bin/openclaw
COPY --chmod=0644 openclaw.json /etc/openclaw/openclaw.json
COPY --chmod=0644 policy.yaml /etc/openshell/policy.yaml

# /var/tmp is not writable under the baseline Landlock policy (only /sandbox, /tmp).
ENV TMPDIR=/tmp \
    SQLITE_TMPDIR=/tmp \
    LITELLM_BASE_URL=http://litellm.litellm.svc.cluster.local:4000/v1 \
    OPENCLAW_STATE_DIR=/sandbox/.openclaw \
    OPENCLAW_CONFIG_PATH=/sandbox/.openclaw/openclaw.json

LABEL org.opencontainers.image.title="openclaw-sandbox" \
      org.opencontainers.image.description="OpenClaw ${OPENCLAW_VERSION} for OpenShell 0.1.x sandboxes, models via LiteLLM" \
      org.opencontainers.image.version="${OPENCLAW_VERSION}" \
      org.opencontainers.image.source="https://github.com/ansjindal/openshell-on-k8s"

USER sandbox
WORKDIR /sandbox
