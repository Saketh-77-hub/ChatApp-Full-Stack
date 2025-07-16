# Deployment Guide

## For Cross-Device Video/Audio Calls

### Local Network Testing
1. Find your computer's IP address:
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```

2. Update frontend environment:
   ```bash
   # frontend/.env
   VITE_BACKEND_URL=http://[YOUR_IP]:5002
   ```

3. Start servers:
   ```bash
   # Backend
   cd backend && npm run dev

   # Frontend  
   cd frontend && npm run dev
   ```

4. Access from other devices: `http://[YOUR_IP]:5173`

### Production Deployment

#### Backend (Railway/Render/Heroku)
1. Set environment variables:
   ```
   NODE_ENV=production
   PORT=5002
   CLIENT_URL=https://your-frontend-domain.com
   MONGODB_URL=your-mongodb-connection-string
   JWT_SECRET=your-jwt-secret
   ```

#### Frontend (Vercel/Netlify)
1. Set environment variables:
   ```
   VITE_BACKEND_URL=https://your-backend-domain.com
   ```

2. Build and deploy:
   ```bash
   npm run build
   ```

### Features Ready:
✅ Real-time messaging
✅ Video calls (cross-device)
✅ Audio calls (cross-device) 
✅ Online users tracking
✅ WebRTC with TURN servers
✅ Socket.io communication
✅ User authentication
✅ File uploads (Cloudinary)

### Network Requirements:
- HTTPS required for production WebRTC
- TURN servers configured for NAT traversal
- CORS properly configured for cross-origin requests