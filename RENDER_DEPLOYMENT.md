# Render Deployment Guide

## Backend Deployment (First)

1. **Create Render Web Service**
   - Connect your GitHub repo
   - Select backend folder
   - Build Command: `npm install`
   - Start Command: `npm start`

2. **Environment Variables**
   ```
   NODE_ENV=production
   PORT=5002
   MONGODB_URL=your-mongodb-connection-string
   JWT_SECRET=your-jwt-secret
   CLOUDINARY_CLOUD_NAME=your-cloudinary-name
   CLOUDINARY_API_KEY=your-cloudinary-key
   CLOUDINARY_API_SECRET=your-cloudinary-secret
   CLIENT_URL=https://your-frontend-render-url.onrender.com
   ```

3. **Get Backend URL**
   - After deployment, copy the backend URL (e.g., `https://your-backend.onrender.com`)

## Frontend Deployment (Second)

1. **Create Render Static Site**
   - Connect your GitHub repo
   - Select frontend folder
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

2. **Environment Variables**
   ```
   VITE_BACKEND_URL=https://your-backend.onrender.com
   ```

3. **Update Backend CLIENT_URL**
   - Go back to backend service
   - Update CLIENT_URL with your frontend URL

## Testing Cross-Device Calls

1. **Both services must be deployed**
2. **Access frontend URL from different devices**
3. **Login with different accounts**
4. **Test video/audio calls**

## Important Notes

- Backend must be deployed first to get the URL
- Frontend needs backend URL in environment variables
- Backend needs frontend URL for CORS
- Both services need HTTPS for WebRTC to work properly
- Free tier services may sleep - first request might be slow