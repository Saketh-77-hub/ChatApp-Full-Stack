import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// ✅ Store userId ↔ socketId
const userSocketMap = {}; // { userId: socketId }

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"], // Adjust for frontend URL
  },
});

// Utility to get socketId from userId
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Main Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // Send list of online users
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ========== 🔔 SIGNALING EVENTS FOR CALLS ==========

  // 📞 Send offer to callee
  socket.on("call-user", ({ to, offer }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("incoming-call", {
        from: userId,
        offer,
      });
    }
  });

  // ✅ Send answer back to caller
  socket.on("answer-call", ({ to, answer }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-accepted", {
        from: userId,
        answer,
      });
    }
  });

  // ❄️ Exchange ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        from: userId,
        candidate,
      });
    }
  });

  // ❌ Handle hang up
  socket.on("end-call", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended", {
        from: userId,
      });
    }
  });

  // 🔌 Handle disconnection
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
