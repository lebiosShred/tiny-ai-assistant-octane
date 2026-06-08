FROM node:20-slim

WORKDIR /app

# Copy package descriptors first to cache dependency layers
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps

# Copy application code, backend service, and directories
COPY server.js ./
COPY gdrive-service.js ./
COPY email-service.js ./
COPY openapi.json ./
COPY credentials/ ./credentials/
COPY config/ ./config/
COPY demo/ ./demo/
COPY knowledge/ ./knowledge/
COPY knowledge_backup/ ./knowledge_backup/
COPY api/ ./api/

# Expose default HTTP port
EXPOSE 8080

# Run the Node server
CMD ["node", "server.js"]
