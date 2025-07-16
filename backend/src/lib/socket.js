import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// 🔁 Track userId <-> socketId
const userSocketMap = {}; // { userId: socketId }

// Add busy/timeout state tracking
const callState = {}; // { userId: 'idle' | 'ringing' | 'in-call' | 'busy' }

// Add a map to track last warning time for ICE candidate delivery failures
const iceWarningTimestamps = {}; // { userId: timestamp }

const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL || "*"
        : ["http://localhost:5173"], // dev frontend URL
    credentials: true,
  },
});

// 🔍 Utility: get socketId for user
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// 🌐 Main Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  const userId = socket.handshake.query.userId;
  console.log("🆔 User ID from query:", userId);

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    callState[userId] = "idle";
    console.log("✅ Updated userSocketMap:", userSocketMap);
  }

  // 🔔 Notify all users who is online
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // 💬 Handle direct messaging
  socket.on("sendMessage", (messageData) => {
    const receiverSocketId = getReceiverSocketId(messageData.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData);
    }
  });

  // 📞 Caller initiates call
  socket.on("call-user", ({ to, offer, callType }) => {
    if (callState[to] === "in-call" || callState[to] === "ringing") {
      socket.emit("busy", { to });
      return;
    }
    callState[userId] = "ringing";
    callState[to] = "ringing";
    console.log(`📞 Call attempt from ${userId} to ${to}`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("incoming-call", {
        from: userId,
        offer,
        callType,
      });
      console.log(`📞 Sent incoming-call to ${targetSocketId}`);
      // Confirm call was sent
      socket.emit("call-sent", { to, status: "sent" });
    } else {
      console.log(`⚠️ User ${to} not found or offline`);
      socket.emit("call-failed", { to, reason: "User offline" });
    }
  });

  // ✅ Callee sends answer
  socket.on("answer-call", ({ to, answer }) => {
    callState[userId] = "in-call";
    callState[to] = "in-call";
    console.log(`✅ Answer from ${userId} to ${to}`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("answer-call", {
        from: userId,
        answer,
      });
      console.log(`✅ Sent answer-call to ${targetSocketId}`);
    } else {
      console.log(`⚠️ Cannot send answer - user ${to} not found`);
    }
  });

  // ❄️ ICE Candidate Exchange
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        from: userId,
        candidate,
      });
      console.log(`❄️ ICE candidate sent from ${userId} to ${to}`);
    } else {
      // Suppress repeated warnings for the same user within 10 seconds
      const now = Date.now();
      if (!iceWarningTimestamps[to] || now - iceWarningTimestamps[to] > 10000) {
        console.log(`⚠️ Cannot send ICE candidate - user ${to} not found`);
        iceWarningTimestamps[to] = now;
      }
      socket.emit("call-failed", { to, reason: "User offline" });
    }
  });

  // ❌ End Call
  socket.on("end-call", ({ to }) => {
    callState[userId] = "idle";
    callState[to] = "idle";
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended", {
        from: userId,
      });
    }
  });

  // ⏰ Call timeout
  socket.on("call-timeout", ({ to }) => {
    callState[userId] = "idle";
    callState[to] = "idle";
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-timeout", { from: userId });
    }
  });

  // 🔌 Disconnect cleanup
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      delete callState[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

// For production: Use Redis adapter for multi-instance scaling
// import { createAdapter } from '@socket.io/redis-adapter';
// io.adapter(createAdapter(redisClient, pubClient));

export { io, app, server };
