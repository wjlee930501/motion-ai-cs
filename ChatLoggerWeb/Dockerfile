# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Production API URL
ENV VITE_API_URL=https://cs-dashboard-api-302501051708.asia-northeast3.run.app

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# GCP Cloud Run uses PORT env variable (default 8080)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
