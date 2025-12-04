# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install wget for health checks
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy application code
COPY . .

# Expose port (Railway will set this via PORT env variable)
EXPOSE ${PORT:-3000}

# Set environment to production
ENV NODE_ENV=production

# Health check - using /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["node", "app.js"]
