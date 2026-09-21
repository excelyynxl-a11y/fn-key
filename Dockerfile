FROM node:24-bookworm-slim AS client-build

WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:24-bookworm-slim AS server-dependencies

WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production \
    DATASET_PATH=/app/shipmail-hackathon-bundle \
    CLIENT_DIST_PATH=/app/client-dist

WORKDIR /app/server
COPY --from=server-dependencies /build/server/node_modules ./node_modules
COPY server/ ./
COPY --from=client-build /build/client/dist /app/client-dist
COPY shipmail-hackathon-bundle/ /app/shipmail-hackathon-bundle/

USER node
EXPOSE 10000
CMD ["node", "server.js"]
