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

# Copy root package.json (backend deps)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend code
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Switch to non-root user
USER nodejs

EXPOSE 8080

CMD ["node", "server/server.js"]
