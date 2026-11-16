FROM node:22-bookworm-slim

# Install system dependencies needed for native SQLite build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first for optimal layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for vite build)
RUN npm install

# Copy application source code
COPY . .

# Build the client SPA into dist/
RUN npm run build

# Expose server port (default 4000)
ENV PORT=4000
EXPOSE 4000

# Persistent SQLite storage directory volume
VOLUME ["/app/server/data"]

# Run production server
CMD ["node", "server/index.js"]

