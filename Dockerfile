# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Next.js application
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built code and required assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/models ./models
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/constants ./constants
COPY --from=builder /app/types ./types
COPY --from=builder /app/utils ./utils

# Set user for security (rootless container)
USER node

EXPOSE 3000

CMD ["node", "server.js"]
