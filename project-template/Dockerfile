FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /opt/project
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN node .templux/verify.mjs . && npm ci --ignore-scripts --no-audit --no-fund && node .templux/verify.mjs . --installed
FROM dependencies AS api-build
RUN npm run build --workspace project-api
FROM dependencies AS web-build
RUN npm run build --workspace project-web
FROM node:24.21.0-bookworm-slim AS api
WORKDIR /opt/project
ENV NODE_ENV=production NODE_OPTIONS=--no-warnings
COPY --from=dependencies /opt/project/package.json /opt/project/package-lock.json ./
COPY --from=dependencies /opt/project/apps/api/package.json apps/api/package.json
COPY --from=dependencies /opt/project/apps/web/package.json apps/web/package.json
COPY --from=dependencies /opt/project/vendor vendor
COPY --from=dependencies /opt/project/.templux .templux
COPY --from=dependencies /opt/project/templux.lock.json templux.lock.json
RUN node .templux/verify.mjs . && npm ci --ignore-scripts --omit=dev --workspace project-api --no-audit --no-fund
COPY --from=api-build /opt/project/apps/api/dist apps/api/dist
COPY --from=dependencies /opt/project/config config
COPY --from=dependencies /opt/project/tools tools
USER node
CMD ["node","apps/api/dist/server.js"]
FROM node:24.21.0-bookworm-slim AS web
WORKDIR /opt/project
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--no-warnings
COPY --from=dependencies /opt/project/package.json /opt/project/package-lock.json ./
COPY --from=dependencies /opt/project/apps/api/package.json apps/api/package.json
COPY --from=dependencies /opt/project/apps/web/package.json apps/web/package.json
COPY --from=dependencies /opt/project/vendor vendor
COPY --from=dependencies /opt/project/.templux .templux
COPY --from=dependencies /opt/project/templux.lock.json templux.lock.json
RUN node .templux/verify.mjs . && npm ci --ignore-scripts --omit=dev --workspace project-web --no-audit --no-fund
COPY --from=web-build --chown=node:node /opt/project/apps/web/.next apps/web/.next
COPY --from=dependencies /opt/project/apps/web/server.mjs apps/web/server.mjs
COPY --from=dependencies /opt/project/apps/web/next.config.ts apps/web/next.config.ts
COPY --from=dependencies /opt/project/node_modules/@templux/web/apps/web/public apps/web/public
COPY --from=dependencies /opt/project/config config
USER node
CMD ["node","apps/web/server.mjs"]
FROM postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c AS pg-tools
RUN mkdir -p /opt/pg-tools/bin /opt/pg-tools/lib && cp /usr/lib/postgresql/18/bin/pg_dump /usr/lib/postgresql/18/bin/pg_restore /usr/lib/postgresql/18/bin/psql /opt/pg-tools/bin/ && ldd /opt/pg-tools/bin/* | awk '/=> \// {print $3}' | sort -u | xargs -r cp -L -t /opt/pg-tools/lib/
FROM api AS migration
USER root
COPY --from=pg-tools /opt/pg-tools /opt/pg-tools
ENTRYPOINT ["node","tools/migrate.mjs"]
FROM docker:29.8.2-cli AS docker-client
FROM api AS management
ENV TEMPLUX_REQUIRE_AUTH_PROJECTION=1
USER root
COPY --from=pg-tools /opt/pg-tools /opt/pg-tools
COPY --from=docker-client /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
ENTRYPOINT ["node","tools/manage.mjs"]
FROM dependencies AS checks
RUN npm run build --workspace project-api
CMD ["npm","test"]
