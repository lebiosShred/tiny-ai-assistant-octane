FROM node:20-slim

WORKDIR /app

# Copy the server file, public directories, and assets
COPY server.js ./
COPY openapi.json ./
COPY demo/ ./demo/
COPY knowledge/ ./knowledge/
COPY knowledge_backup/ ./knowledge_backup/

# Expose default HTTP port
EXPOSE 8080

# Run the Node server
CMD ["node", "server.js"]
