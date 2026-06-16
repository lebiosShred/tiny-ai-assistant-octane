FROM node:20-slim

WORKDIR /app

# Copy package descriptors first to cache dependency layers
COPY package*.json ./

# Install build dependencies for native modules like better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*


# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps

# Copy application code, backend service, static files and directories
COPY server.js ./
COPY gdrive-service.js ./
COPY email-service.js ./
COPY openapi.json ./
COPY index.html app.js styles.css ai-assistant.js ./
COPY assets/ ./assets/
COPY config/ ./config/
COPY knowledge/ ./knowledge/
COPY knowledge_backup/ ./knowledge_backup/
COPY api/ ./api/
COPY src/ ./src/
# Expose default HTTP port
EXPOSE 8080

# Run the Node server
CMD ["node", "server.js"]
