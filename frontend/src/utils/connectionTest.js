// Connection and WebRTC Test Utility
import { socket } from "../socket";

export const testBackendConnection = async () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5002";
  
  try {
    const response = await fetch(`${backendUrl}/api/status`);
    const data = await response.json();
    console.log("✅ Backend Status:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Backend Connection Failed:", error);
    return { success: false, error: error.message };
  }
};

export const testSocketConnection = () => {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ success: false, error: "Socket not initialized" });
      return;
    }

    if (socket.connected) {
      console.log("✅ Socket Already Connected:", socket.id);
      resolve({ success: true, socketId: socket.id });
      return;
    }

    const timeout = setTimeout(() => {
      resolve({ success: false, error: "Socket connection timeout" });
    }, 5000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      console.log("✅ Socket Connected:", socket.id);
      resolve({ success: true, socketId: socket.id });
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      console.error("❌ Socket Connection Error:", error);
      resolve({ success: false, error: error.message });
    });
  });
};

export const testMediaDevices = async () => {
  try {
    // Test video access
    const videoStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    console.log("✅ Video/Audio Access:", videoStream.getTracks().length, "tracks");
    
    // Test audio only
    const audioStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: false 
    });
    console.log("✅ Audio Only Access:", audioStream.getTracks().length, "tracks");
    
    // Cleanup
    videoStream.getTracks().forEach(track => track.stop());
    audioStream.getTracks().forEach(track => track.stop());
    
    return { 
      success: true, 
      videoTracks: videoStream.getVideoTracks().length,
      audioTracks: videoStream.getAudioTracks().length 
    };
  } catch (error) {
    console.error("❌ Media Device Access Failed:", error);
    return { success: false, error: error.message };
  }
};

export const testWebRTCConnection = async () => {
  try {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    // Test ICE gathering
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    console.log("✅ WebRTC Peer Connection Created");
    console.log("✅ Local Description Set");
    
    pc.close();
    return { success: true };
  } catch (error) {
    console.error("❌ WebRTC Test Failed:", error);
    return { success: false, error: error.message };
  }
};

export const runFullConnectionTest = async () => {
  console.log("🔍 Starting Full Connection Test...");
  
  const results = {
    backend: await testBackendConnection(),
    socket: await testSocketConnection(),
    media: await testMediaDevices(),
    webrtc: await testWebRTCConnection(),
  };
  
  console.log("📊 Test Results:", results);
  
  const allPassed = Object.values(results).every(r => r.success);
  console.log(allPassed ? "✅ All Tests Passed!" : "❌ Some Tests Failed!");
  
  return results;
};