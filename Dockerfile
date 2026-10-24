# syntax=docker/dockerfile:1
# Default: build this checkout, including the static UI, inside Docker.
# Release CI can reuse its compiled dist/<TARGETARCH>/artex artifacts with
# --build-arg ARTEX_BINARY_SOURCE=prebuilt (requires BuildKit).
ARG ARTEX_BINARY_SOURCE=source

FROM --platform=$BUILDPLATFORM node:22.23.4-bookworm-slim AS frontend
WORKDIR /src/web
COPY scripts/check-node-security.cjs /src/scripts/check-node-security.cjs
RUN node /src/scripts/check-node-security.cjs
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build:static

FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS source
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/web/out/ ./server/webui/dist/
ARG TARGETARCH
ARG ARTEX_BUILD_VERSION=dev
RUN test -n "$TARGETARCH" \
    && mkdir -p /dist/$TARGETARCH \
    && CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build \
       -tags embedui -trimpath \
       -ldflags "-s -w -buildid= -X main.version=$ARTEX_BUILD_VERSION" \
       -o /dist/$TARGETARCH/artex ./cmd/artex

FROM scratch AS prebuilt
COPY dist/ /dist/

FROM ${ARTEX_BINARY_SOURCE} AS binary

FROM python:3.12-slim-bookworm
ARG TARGETARCH
# 常用工具：ripgrep / curl / vim，加一批 recon 常备件（按需增删）。
# CVE-2026-111497: install supported Node.js 22, then enforce the patched floor.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates ripgrep curl wget vim git jq unzip \
      dnsutils iputils-ping netcat-openbsd inetutils-telnet whois nmap \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/check-node-security.cjs /app/scripts/check-node-security.cjs
RUN node /app/scripts/check-node-security.cjs
# 预装 Playwright MCP 与 CLI（全局），运行时不再 npx 联网下载。
# @playwright/mcp：browser MCP 直接 `npx @playwright/mcp`（已全局装好，无需 -y/@latest）。
# @playwright/cli：提供 playwright-cli，装完顺带 --help 验证可执行。
# 再装 playwright（提供浏览器管理），装完用 --with-deps 预置 chromium 及其系统依赖，
# 这样容器内 MCP/CLI 首次启动即可用，不再联网下载浏览器。
RUN npm install -g @playwright/mcp@latest @playwright/cli@latest playwright@latest \
    && playwright-cli --help \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# 预编译好的对应架构二进制（dist/amd64/artex 或 dist/arm64/artex）
COPY --from=binary /dist/${TARGETARCH}/artex /app/artex
# 守护启动脚本：进程退出后按退出码决定是否重新拉起，页面一键更新靠它完成换装。
# 它同时负责把 SIGTERM 转发给 artex —— docker stop 只把信号发给 PID 1，
# 不转发的话 artex 收不到、做不了优雅关闭，10 秒后被 SIGKILL 硬杀。
COPY start.sh /app/start.sh
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/artex /app/start.sh /app/docker-entrypoint.sh
COPY skills/ /app/skills/
# data/（SQLite + jwt.key）持久化点
VOLUME ["/app/data"]
EXPOSE 8787 8788
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["-addr", ":8787", "-proxy", ":8788"]

