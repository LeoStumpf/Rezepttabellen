# Enthält Node und Chromium (für den PDF-Export) – Version passend zu playwright-core
FROM mcr.microsoft.com/playwright:v1.64.0-noble

WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund

COPY shared shared
COPY web web
COPY server server
RUN npm run build

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/data \
    HOME=/tmp
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["node_modules/.bin/tsx", "server/src/main.ts"]
