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

  if (userId && userId !== "undefined" && userId !== "null") {
    // Remove any existing connection for this user
    const existingSocketId = userSocketMap[userId];
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`🔄 Replacing existing connection for user ${userId}`);
      // Disconnect the old socket if it exists
      const oldSocket = io.sockets.sockets.get(existingSocketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }
    
    userSocketMap[userId] = socket.id;
    callState[userId] = "idle";
    console.log("✅ Updated userSocketMap:", userSocketMap);
    
    // 🔔 Notify all users who is online (broadcast to everyone)
    const onlineUsers = Object.keys(userSocketMap);
    console.log("📢 Broadcasting online users to all clients:", onlineUsers);
    
    // Emit to all connected clients
    io.emit("getOnlineUsers", onlineUsers);
    
    // Also send directly to the newly connected user
    socket.emit("getOnlineUsers", onlineUsers);
    
    console.log(`👤 User ${userId} is now online. Total online: ${onlineUsers.length}`);
  } else {
    console.log("⚠️ Invalid userId:", userId, "- not adding to userSocketMap");
  }

  // Handle request for online users
  socket.on("getOnlineUsers", () => {
    const onlineUsers = Object.keys(userSocketMap);
    console.log("📤 Client", socket.id, "requested online users. Sending:", onlineUsers);
    socket.emit("getOnlineUsers", onlineUsers);
  });

  // Debug: Log when client sends any event
  socket.onAny((event, ...args) => {
    if (event !== "getOnlineUsers" && event !== "ice-candidate") {
      console.log(`📡 Event from ${userId} (${socket.id}):`, event, args);
    }
  });

  // 💬 Handle direct messaging
  socket.on("sendMessage", (messageData) => {
    console.log("📨 Sending message:", messageData);
    const receiverSocketId = getReceiverSocketId(messageData.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData);
      // Confirm message delivery to sender
      socket.emit("messageDelivered", { messageId: messageData._id, status: "delivered" });
    } else {
      console.log("⚠️ Receiver not online, message will be stored in DB only");
      socket.emit("messageDelivered", { messageId: messageData._id, status: "offline" });
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

  // ❌ Reject Call
  socket.on("reject-call", ({ to }) => {
    callState[userId] = "idle";
    callState[to] = "idle";
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-rejected", {
        from: userId,
      });
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
    console.log("❌ User disconnected:", socket.id, "userId:", userId);
    if (userId && userId !== "undefined" && userId !== "null") {
      // Only delete if this socket belongs to this user
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        delete callState[userId];
        delete iceWarningTimestamps[userId];
        
        // Notify all users about updated online status
        const onlineUsers = Object.keys(userSocketMap);
        io.emit("getOnlineUsers", onlineUsers);
        console.log("📊 Updated online users after disconnect:", onlineUsers);
      } else {
        console.log("🔄 Socket mismatch, not removing user from map");
      }
    }
  });

  // Handle manual user status updates
  socket.on("updateUserStatus", ({ status }) => {
    if (userId) {
      console.log(`👤 User ${userId} status updated to: ${status}`);
      socket.broadcast.emit("userStatusChanged", { userId, status });
    }
  });
});

// For production: Use Redis adapter for multi-instance scaling
// import { createAdapter } from '@socket.io/redis-adapter';
// io.adapter(createAdapter(redisClient, pubClient));

export { io, app, server };
