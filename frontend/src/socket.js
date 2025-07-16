import { io } from "socket.io-client";

let socket = null;

export const connectSocket = (userId) => {
  if (!userId) return;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5002";
  console.log("Socket connecting to:", backendUrl);
  console.log("Connecting to:", backendUrl);
  
  socket = io(backendUrl, {
    query: { userId },
    transports: ["websocket", "polling"],
    timeout: 20000,
    forceNew: true,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error);
  });
};

export { socket };
