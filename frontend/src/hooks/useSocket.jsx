import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { connectSocket, disconnectSocket, setSocketCallbacks, requestOnlineUsers } from "../socket";

const useSocket = () => {
  const { authUser, setOnlineUsers, onlineUsers } = useAuthStore();
  const { addMessage, selectedUser } = useChatStore();

  useEffect(() => {
    if (!authUser?._id) {
      console.log("🔌 No authenticated user, disconnecting socket");
      disconnectSocket();
      return;
    }

    console.log("🔌 Setting up socket for user:", authUser._id);

    // Set up callbacks for socket events
    const handleOnlineUsers = (users) => {
      console.log("👥 Updating online users in store:", users);
      setOnlineUsers(users);
    };

    const handleNewMessage = (message) => {
      console.log("💬 Adding new message to store:", message);
      if (addMessage) {
        addMessage(message);
      }
    };

    // Set callbacks before connecting
    setSocketCallbacks(handleOnlineUsers, handleNewMessage);

    // Connect socket
    const socket = connectSocket(authUser._id);

    // Request online users after a short delay
    const timeoutId = setTimeout(() => {
      requestOnlineUsers();
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      // Don't disconnect socket here as it might be used by other components
    };
  }, [authUser?._id, setOnlineUsers, addMessage]);

  // Debug: Log online users changes
  useEffect(() => {
    console.log("🔍 Online users in store updated:", onlineUsers);
  }, [onlineUsers]);

  // Periodically request online users to ensure sync
  useEffect(() => {
    if (!authUser?._id) return;

    const interval = setInterval(() => {
      requestOnlineUsers();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [authUser?._id]);

  return null;
};

export default useSocket;