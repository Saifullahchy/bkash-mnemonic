# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Baked in at build time: rebuild after changing one.
ARG NEXT_PUBLIC_SITE_URL
ARG API_URL
ARG IMAGE_REMOTE_PATTERNS
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && rm -rf .next/cache && npm prune --omit=dev

# ---- runtime (PROXY_SECRET and CLIENT_IP_HEADER come from the environment here) ----
FROM node:22-alpine
# next.config.ts is read again at startup.
ARG NEXT_PUBLIC_SITE_URL
ARG API_URL
ARG IMAGE_REMOTE_PATTERNS
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL API_URL=$API_URL IMAGE_REMOTE_PATTERNS=$IMAGE_REMOTE_PATTERNS
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts /app/security-headers.ts /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:$PORT/healthz || exit 1
CMD ["npm", "start"]
