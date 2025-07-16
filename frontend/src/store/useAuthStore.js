import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { socket, connectSocket } from "../socket";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5002" : "/";


export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
      window.location.href = "/login";
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return;
    
    connectSocket(authUser._id);
    
    // Set up online users listener
    const setupListener = () => {
      if (socket?.connected) {
        socket.off("getOnlineUsers"); // Remove existing listener
        socket.on("getOnlineUsers", (userIds) => {
          console.log("Received online users:", userIds);
          const filteredUsers = userIds.filter(id => id !== authUser._id);
          console.log("Filtered online users:", filteredUsers);
          set({ onlineUsers: filteredUsers });
        });
      } else {
        setTimeout(setupListener, 500);
      }
    };
    
    setupListener();
  },
  disconnectSocket: () => {
    if (socket?.connected) socket.disconnect();
  },
  
  setOnlineUsers: (userIds) => {
    set({ onlineUsers: userIds });
  },
}));