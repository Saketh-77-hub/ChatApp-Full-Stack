import { io } from "socket.io-client";

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Connect to Socket.IO server with the given userId
 * and store the socket instance.
 */
export const connectSocket = (userId) => {
  if (!userId) return;

  // If socket already exists and is connected, don't create a new one
  if (socket && socket.connected) {
    console.log("Socket already connected, reusing existing connection");
    return socket;
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
  
  // Close existing socket if it exists but don't create a new one immediately
  if (socket) {
    console.log("Disconnecting existing socket");
    socket.disconnect();
    socket = null;
  }
  
  // Create new socket with proper error handling
  try {
    socket = io(backendUrl, {
      query: { userId },
      transports: ["polling", "websocket"], // Start with polling, then upgrade to websocket
      timeout: 20000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
    });
    
    socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
    });
    
    socket.on("reconnect_attempt", (attemptNumber) => {
      reconnectAttempts = attemptNumber;
      console.log(`🔄 Socket reconnect attempt ${attemptNumber}/${MAX_RECONNECT_ATTEMPTS}`);
    });
    
    socket.on("reconnect_failed", () => {
      console.error("❌ Socket reconnection failed after all attempts");
    });
    
    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
    });
    
    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
    });
    
    return socket;
  } catch (err) {
    console.error("Failed to initialize socket connection:", err);
    return null;
  }
};

/**
 * Check if socket is connected and try to reconnect if not
 */
export const ensureSocketConnected = (userId) => {
  if (!userId) return null;
  
  // If socket doesn't exist, create a new one
  if (!socket) {
    console.log("Socket doesn't exist, creating new connection");
    return connectSocket(userId);
  }
  
  // If socket exists but isn't connected, try to reconnect
  if (!socket.connected) {
    console.log("Socket exists but not connected, attempting to reconnect");
    socket.connect();
  }
  
  return socket;
};

/**
 * Get the current connected socket instance.
 */
export { socket };
