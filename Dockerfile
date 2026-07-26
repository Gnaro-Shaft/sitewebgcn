# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy root package.json (backend deps) as root, then install
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend code and scripts with correct ownership
COPY --chown=nodejs:nodejs server/ ./server/
COPY --chown=nodejs:nodejs scripts/ ./scripts/

# Copy built frontend
COPY --from=frontend-build --chown=nodejs:nodejs /app/client/dist ./client/dist

# Create required directories for security middleware
RUN mkdir -p /app/server/logs /app/logs && chown -R nodejs:nodejs /app/server/logs /app/logs

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Switch to non-root user
USER nodejs

EXPOSE 8080

CMD ["node", "server/server.js"]
