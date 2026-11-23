# syntax=docker/dockerfile:1

# ---- Stage 1: install all dependencies (cached while package*.json is unchanged) ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- Stage 2: generate the Prisma client and compile TypeScript ----
FROM deps AS build
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# DATABASE_URL is only needed so prisma.config.ts loads; no connection is made at generate time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && npm run build

# ---- Stage 3: production-only dependencies ----
FROM node:26-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- Stage 4: one-shot migration runner (needs the Prisma CLI from devDependencies) ----
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- Stage 5: minimal runtime image ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
# The generated Prisma client lives outside @prisma/client, so copy it from the build stage.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY public ./public

# Run as the unprivileged user that ships with the node image.
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
