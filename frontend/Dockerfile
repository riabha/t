# Build stage
FROM node:20-slim as build-stage

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

# Copy the build output from the build stage to Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration if needed (explained below)
# For now, we'll use a simple config inline or just fallback to default
# But wait, we NEED to handle React Router and Proxy to /api

# Create a custom nginx config
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://backend:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
