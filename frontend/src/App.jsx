import useWebRTC from "./hooks/useWebRTC"; // ✅ 1. Import the hook
import Navbar from "./components/Navbar";
import CallModal from "./components/CallModal"; // ✅ 2. Import CallModal

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, onlineUsers } = useAuthStore();
  const { theme } = useThemeStore();

  useWebRTC(); // ✅ 3. Initialize socket and WebRTC listeners

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
  const { authUser } = useAuthStore.getState();

  if (authUser?._id) {
    socket.io.opts.query = { userId: authUser._id };
    socket.connect();
  }
}, []);



  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    <div data-theme={theme}>
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
      </Routes>

      <CallModal /> {/* ✅ 4. Always mounted for incoming/outgoing call */}
      
      <Toaster />
    </div>
  );
};

export default App;
