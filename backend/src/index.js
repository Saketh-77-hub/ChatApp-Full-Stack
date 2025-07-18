// Core and third-party packages
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Local modules (with .js extensions)
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";


// Load environment variables
dotenv.config();
const PORT = process.env.PORT || 5000;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================
// Middleware
// =====================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? process.env.CLIENT_URL || "*"
    : true, // Allow all origins in development
  credentials: true,
}));

// =====================
// API Routes
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Health check endpoint
app.get("/api/status", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Server is running",
    socketEnabled: true,
    timestamp: new Date().toISOString()
  });
});

// =====================
// Static Files (Production)
// =====================
if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(clientPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

// =====================
// Start Server
// =====================
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌐 Server accessible at http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://[YOUR_IP]:${PORT}`);
  await connectDB();
});
