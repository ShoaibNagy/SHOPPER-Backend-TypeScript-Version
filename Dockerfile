FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build compiles TypeScript to dist/ — used by the production stage.
# The builder stage itself is also used directly by docker-compose.yml
# for development (ts-node-dev runs against src/ with node_modules present).
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p upload/images logs

EXPOSE 4000
CMD ["node", "dist/server.js"]