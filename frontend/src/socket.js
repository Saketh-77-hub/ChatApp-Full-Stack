import { io } from "socket.io-client";

let socket = null;

/**
 * Connect to Socket.IO server with the given userId
 * and store the socket instance.
 */
export const connectSocket = (userId) => {
  if (!userId) return;

  socket = io("http://localhost:5001", {
    query: { userId },
    transports: ["websocket"], // optional, to avoid long polling fallback
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
