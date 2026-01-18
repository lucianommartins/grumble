# Stage 1: Build Angular app
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments from Cloud Build substitutions
ARG APP_SECRET
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID

# Copy frontend package files
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy Angular config files
COPY angular.json tsconfig*.json ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Generate environment.ts from build args
RUN echo "export const environment = { \
  production: true, \
  appSecret: '${APP_SECRET}', \
  firebase: { \
    apiKey: '${FIREBASE_API_KEY}', \
    authDomain: '${FIREBASE_AUTH_DOMAIN}', \
    projectId: '${FIREBASE_PROJECT_ID}', \
    storageBucket: '${FIREBASE_STORAGE_BUCKET}', \
    messagingSenderId: '${FIREBASE_MESSAGING_SENDER_ID}', \
    appId: '${FIREBASE_APP_ID}' \
  } \
};" > ./src/environments/environment.ts

# Build Angular app for production
RUN npm run build

# Stage 2: Setup server
FROM node:22-alpine AS production

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy server source
COPY server/index.js ./

# Copy built Angular app from builder stage
COPY --from=builder /app/dist/devpulse/browser /app/dist/devpulse/browser

WORKDIR /app/server

# Cloud Run sets PORT environment variable
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", "index.js"]
