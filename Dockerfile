FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /opt/templux
ENV NEXT_TELEMETRY_DISABLED=1
# git is required by upgrade/updates checks (git diff/merge-file); only the tools images inherit this stage.
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM dependencies AS source
COPY templux templux
COPY apps apps
COPY database database
COPY tests tests
COPY shared shared
COPY .env.example .env.example
COPY config config
COPY tools tools
COPY project-template project-template
COPY release.config.json release.config.json
COPY .git .git

FROM source AS api-build
RUN npm run build --workspace @templux/api

FROM node:24.21.0-bookworm-slim AS api
WORKDIR /opt/templux
ENV NODE_ENV=production NODE_OPTIONS=--no-warnings
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @templux/api
COPY --from=api-build /opt/templux/apps/api/dist apps/api/dist
COPY database database
COPY shared shared
COPY .env.example .env.example
COPY config config
USER node
CMD ["node", "apps/api/dist/server.js"]

FROM source AS web-build
RUN node tools/build-metadata/resolve.mjs > /tmp/templux-build-metadata \
  && NEXT_PUBLIC_BUILD_MONTH="$(head -n 1 /tmp/templux-build-metadata)" NEXT_PUBLIC_BUILD_COMMIT="$(tail -n 1 /tmp/templux-build-metadata)" npm run build --workspace @templux/web

FROM node:24.21.0-bookworm-slim AS web
WORKDIR /opt/templux
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--no-warnings
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @templux/web
COPY --from=web-build --chown=node:node /opt/templux/apps/web/.next apps/web/.next
COPY apps/web/next.config.ts apps/web/next.config.ts
COPY apps/web/server.mjs apps/web/server.mjs
COPY apps/web/project-server.mjs apps/web/project-server.mjs
COPY apps/web/public apps/web/public
COPY shared shared
COPY .env.example .env.example
COPY config config
USER node
CMD ["node", "apps/web/server.mjs"]

FROM postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c AS pg-tools
RUN mkdir -p /opt/pg-tools/bin /opt/pg-tools/lib && cp /usr/lib/postgresql/18/bin/pg_dump /usr/lib/postgresql/18/bin/pg_restore /usr/lib/postgresql/18/bin/psql /opt/pg-tools/bin/ && ldd /opt/pg-tools/bin/pg_dump /opt/pg-tools/bin/pg_restore /opt/pg-tools/bin/psql | awk '/=> \// {print $3}' | sort -u | xargs -r cp -L -t /opt/pg-tools/lib/

FROM api AS migration
USER root
COPY --from=pg-tools /opt/pg-tools /opt/pg-tools
ENTRYPOINT ["node", "apps/api/dist/migrate.js"]

FROM docker:29.8.2-cli AS docker-client
FROM api AS management
ENV TEMPLUX_REQUIRE_AUTH_PROJECTION=1
USER root
COPY --from=pg-tools /opt/pg-tools /opt/pg-tools
COPY --from=docker-client /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
ENTRYPOINT ["node", "/opt/templux/apps/api/dist/manage.js"]

FROM api-build AS checks
COPY --from=pg-tools /opt/pg-tools /opt/pg-tools
CMD ["npm", "test"]

FROM checks AS release-tools
CMD ["node", "tools/release/build.mjs", "/release"]

FROM release-tools AS upgrade-tools
ENTRYPOINT ["node", "tools/upgrade/cli.mjs"]

FROM upgrade-tools AS updates-tools
ENTRYPOINT ["node", "tools/updates/cli.mjs"]
