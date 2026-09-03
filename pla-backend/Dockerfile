# ============================================================
# PLA Backend Dockerfile
# Multi-stage build for optimized production image
# ============================================================

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Build (for transpilation if needed)
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Remove dev dependencies
RUN npm prune --production

# Stage 3: Production
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy application from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Switch to non-root user
USER nodejs

# Start application
CMD ["node", "src/server.js"]