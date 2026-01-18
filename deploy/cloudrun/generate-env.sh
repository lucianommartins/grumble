#!/bin/sh
# Generate environment.ts from Cloud Build substitutions
# This script creates the environment file during the Docker build

cat > /app/src/environments/environment.ts << EOF
export const environment = {
  production: true,
  
  // App encryption secret - combined with user UID for key derivation
  appSecret: '${APP_SECRET}',
  
  // Firebase Configuration
  firebase: {
    apiKey: '${FIREBASE_API_KEY}',
    authDomain: '${FIREBASE_AUTH_DOMAIN}',
    projectId: '${FIREBASE_PROJECT_ID}',
    storageBucket: '${FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${FIREBASE_APP_ID}'
  }
};
EOF

echo "Generated environment.ts with production config"
