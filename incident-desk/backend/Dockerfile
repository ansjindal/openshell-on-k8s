# Backend image: Node app + the `openshell` CLI (the backend shells out to it).
# Build with the REPO ROOT as context:  docker build -f backend/Dockerfile .
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci || npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
# OpenShell CLI is installed ONLY via the official script (Debian package; requires glibc 2.31+,
# so a Debian base — NOT Alpine/musl). Docs: https://docs.nvidia.com/openshell/about/installation
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl python3 sudo \
 && curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh \
 && command -v openshell \
 && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY catalog ./catalog
ENV CATALOG_DIR=/app/catalog PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
