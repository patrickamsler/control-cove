# Single image: the Express server also serves the CRA build (see CLAUDE.md).
# Build for the Pi with:
#   docker buildx build --platform linux/arm64 -t control-cove:latest --load .

# ---------- build ----------
FROM node:24-slim AS build
WORKDIR /app

# shared/ must be installed and built first: both apps resolve
# @control-cove/shared from its compiled dist/, not its source.
COPY shared/package.json shared/package-lock.json ./shared/
COPY shared/tsconfig*.json ./shared/
COPY shared/scripts ./shared/scripts
COPY shared/src ./shared/src
# `prepare` runs the dual cjs/esm build and stamps the "type" package.json files.
RUN npm ci --prefix shared

# REACT_APP_SERVER_URL is substituted into the bundle at build time. Empty means
# "same origin", which is what this image serves. Written to a file rather than
# passed as ENV so CRA sees it as defined-but-empty rather than absent.
ARG REACT_APP_SERVER_URL=""
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY client ./client
RUN echo "REACT_APP_SERVER_URL=$REACT_APP_SERVER_URL" > client/.env.production \
    && npm run build --prefix client

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server
COPY server ./server
RUN npm run build --prefix server

# Drop devDeps now that everything is compiled. shared keeps zod; its dist/ stays.
RUN npm prune --omit=dev --prefix server && npm prune --omit=dev --prefix shared

# ---------- runtime ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    HTTP_PORT=8080 \
    LOG_PATH=/var/log/control-cove

# The /app/shared <-> /app/server layout is load-bearing: server/node_modules
# contains a symlink to ../../../shared created by the `file:../shared` dep.
WORKDIR /app
COPY --from=build /app/shared ./shared
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/build ./server/public

# COPY dereferences symlinks, so re-create the one npm made for the file: dep.
RUN rm -rf server/node_modules/@control-cove/shared \
    && ln -s ../../../shared server/node_modules/@control-cove/shared \
    && mkdir -p "$LOG_PATH" \
    && chown -R node:node "$LOG_PATH" /app

USER node
WORKDIR /app/server
EXPOSE 8080
CMD ["node", "dist/index.js"]
