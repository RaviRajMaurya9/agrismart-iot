# Multi-stage lightweight Node.js container
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy application source
COPY . .

# Expose Web Port
EXPOSE 3000

# Start AgriSmart IoT Server
CMD ["node", "server.js"]
