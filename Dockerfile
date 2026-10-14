FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /opt/templux
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM dependencies AS source
COPY apps apps
COPY database database
COPY tests tests
COPY shared shared
COPY config config

FROM source AS api-build
RUN npm run build --workspace @templux/api

FROM node:24.21.0-bookworm-slim AS api
WORKDIR /opt/templux
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @templux/api
COPY --from=api-build /opt/templux/apps/api/dist apps/api/dist
COPY database database
COPY shared shared
COPY config config
USER node
CMD ["node", "apps/api/dist/server.js"]

FROM source AS web-build
RUN npm run build --workspace @templux/web

FROM node:24.21.0-bookworm-slim AS web
WORKDIR /opt/templux
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @templux/web
COPY --from=web-build --chown=node:node /opt/templux/apps/web/.next apps/web/.next
COPY apps/web/next.config.ts apps/web/next.config.ts
COPY apps/web/public apps/web/public
COPY shared shared
COPY config config
USER node
CMD ["npm", "run", "start", "--workspace", "@templux/web"]

FROM docker:29.8.2-cli AS docker-client
FROM api AS management
USER root
COPY --from=docker-client /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=docker-client /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
ENTRYPOINT ["node", "/opt/templux/apps/api/dist/manage.js"]

FROM api-build AS checks
CMD ["npm", "test"]
