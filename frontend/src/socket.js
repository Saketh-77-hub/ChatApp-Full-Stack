import { io } from "socket.io-client";

let socket = null;
let currentUserId = null;
let onlineUsersCallback = null;
let newMessageCallback = null;

// Set callbacks for store updates
export const setSocketCallbacks = (onlineUsers, newMessage) => {
  onlineUsersCallback = onlineUsers;
  newMessageCallback = newMessage;
};

export const connectSocket = (userId) => {
  if (!userId) {
    console.error("❌ Cannot connect socket: userId is required");
    return;
  }
  
  // Don't reconnect if already connected with same user
  if (socket && socket.connected && currentUserId === userId) {
    console.log("✅ Socket already connected for user:", userId);
    return socket;
  }
  
  // Disconnect existing socket if any
  if (socket) {
    console.log("🔄 Disconnecting existing socket");
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5002";
  console.log("🔌 Connecting socket to:", backendUrl, "for user:", userId);
  
  currentUserId = userId;
  
  socket = io(backendUrl, {
    query: { userId: userId.toString() },
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    forceNew: true,
    autoConnect: true,
    upgrade: true
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id, "for user:", userId);
    console.log("🔗 Socket transport:", socket.io.engine.transport.name);
    
    // Small delay to ensure server has processed the connection
    setTimeout(() => {
      console.log("📤 Requesting online users...");
      socket.emit("getOnlineUsers");
    }, 100);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
    if (reason === "io server disconnect") {
      // Server disconnected, try to reconnect
      socket.connect();
    }
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error.message);
    console.error("Error details:", error);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
    setTimeout(() => {
      socket.emit("getOnlineUsers");
    }, 100);
  });

  // Handle online users updates
  socket.on("getOnlineUsers", (users) => {
    console.log("👥 Online users received:", users);
    console.log("👥 Current user:", userId, "is in list:", users.includes(userId));
    
    if (onlineUsersCallback) {
      onlineUsersCallback(users || []);
    }
    
    // Also dispatch custom event as fallback
    window.dispatchEvent(new CustomEvent('onlineUsersUpdated', { detail: users || [] }));
  });

  // Handle new messages
  socket.on("newMessage", (message) => {
    console.log("📨 New message received:", message);
    
    if (newMessageCallback) {
      newMessageCallback(message);
    }
    
    // Also dispatch custom event as fallback
    window.dispatchEvent(new CustomEvent('newMessage', { detail: message }));
  });

  // Debug: Log all events
  socket.onAny((event, ...args) => {
    console.log("📡 Socket event:", event, args);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log("🔌 Disconnecting socket");
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};

export const getSocket = () => socket;

export const isSocketConnected = () => socket && socket.connected;

export const getCurrentUserId = () => currentUserId;

// Helper function to manually request online users
export const requestOnlineUsers = () => {
  if (socket && socket.connected) {
    console.log("📤 Manually requesting online users...");
    socket.emit("getOnlineUsers");
  } else {
    console.log("⚠️ Cannot request online users - socket not connected");
  }
};

export { socket };
