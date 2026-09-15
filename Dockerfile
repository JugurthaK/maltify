FROM node:22-slim AS build
RUN npm install -g pnpm@10
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

FROM node:22-slim
WORKDIR /app
# The CLI bundle inlines the workspace packages (tsup noExternal) but still
# resolves real npm deps (better-sqlite3, fastify, ...) from node_modules.
COPY --from=build /app /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8790 \
    MALTIFY_DB_PATH=/data/maltify.db
VOLUME /data
EXPOSE 8790
CMD ["node", "packages/cli/dist/index.js", "serve"]
