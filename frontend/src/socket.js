import { io } from "socket.io-client";

let socket = null;

/**
 * Connect to Socket.IO server with the given userId
 * and store the socket instance.
 */
export const connectSocket = (userId) => {
  if (!userId) return;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
  
  socket = io(backendUrl, {
    query: { userId },
    transports: ["websocket", "polling"], // Allow fallback for better connectivity
    timeout: 20000,
    forceNew: true,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });
};

/**
 * Get the current connected socket instance.
 */
export { socket };
