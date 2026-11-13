# pi sandbox image for OpenShell 0.1.x: the OpenShell community base image plus a
# pinned pi (github.com/earendil-works/pi), wired to the lab's LiteLLM gateway.
#
#   - Base: openshell-community/sandboxes/base, pinned by digest (runs as `sandbox`,
#     Node 22, npm, Python, curl, git).
#   - pi goes under /usr/local/lib/pi; /usr/local/bin/pi is a small launcher that
#     seeds ~/.pi/agent/{models.json,settings.json} on first use (LiteLLM, model
#     "default", key from the `litellm` provider's placeholder) and closes stdin
#     for one-shot runs.
#   - /etc/openshell/policy.yaml: the lab baseline (deny all network; model access
#     comes from the `litellm` provider attached to the sandbox).
#
# Built and published by .github/workflows/build-pi-sandbox.yml as
# ghcr.io/<owner>/<repo>/pi-sandbox:<PI_VERSION>; the gateway's default sandbox
# image (sandbox_image_tag in ansible/inventory/group_vars/all.yml) pins it.
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:fffb6b2@sha256:aeef1c63f00e2913ea002ccb3aaf925f338b5c5d70e63576f0d95c16a138044e

ARG PI_VERSION=1.5.2

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN set -eux; \
    npm install --global --prefix /usr/local/lib/pi --cache /tmp/npm-cache \
      --no-audit --no-fund --omit=dev "@earendil-works/pi-coding-agent@${PI_VERSION}"; \
    rm -rf /tmp/npm-cache /root/.npm; \
    test "$(node -p "require('/usr/local/lib/pi/lib/node_modules/@earendil-works/pi-coding-agent/package.json').version")" = "${PI_VERSION}"

RUN install -d -m 0755 /etc/pi
COPY --chmod=0755 pi /usr/local/bin/pi
COPY --chmod=0644 models.json settings.json /etc/pi/
COPY --chmod=0644 policy.yaml /etc/openshell/policy.yaml

# /var/tmp is not writable under the baseline Landlock policy (only /sandbox, /tmp).
ENV TMPDIR=/tmp \
    PI_OFFLINE=1

LABEL org.opencontainers.image.title="pi-sandbox" \
      org.opencontainers.image.description="pi ${PI_VERSION} for OpenShell 0.1.x sandboxes, models via LiteLLM" \
      org.opencontainers.image.version="${PI_VERSION}" \
      org.opencontainers.image.source="https://github.com/ansjindal/openshell-on-k8s"

USER sandbox
WORKDIR /sandbox
