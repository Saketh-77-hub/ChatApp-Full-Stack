import { useEffect, useRef, useCallback } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { socket, connectSocket } from "../socket";

const useWebRTC = () => {
  const {
    setIncomingCall,
    setPeerConnection,
    setLocalStream,
    setRemoteStream,
    setCallActive,
    setCallType,
    resetCall,
  } = useCallStore();

  const { authUser, setOnlineUsers } = useAuthStore();
  const peerConnectionRef = useRef(null);
  const iceCandidatesBuffer = useRef([]);

  // Connect socket when authUser is present
  useEffect(() => {
    let socketCheckInterval;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    
    if (authUser?._id) {
      // Initial connection
      try {
        connectSocket(authUser._id);
      } catch (err) {
        console.error("Initial socket connection failed:", err);
      }
      
      // Set up periodic check to ensure socket stays connected
      socketCheckInterval = setInterval(() => {
        if (!socket || !socket.connected) {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            console.log(`Socket connection check: reconnecting... (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            try {
              connectSocket(authUser._id);
              reconnectAttempts++;
            } catch (err) {
              console.error("Socket reconnection failed:", err);
            }
          } else if (reconnectAttempts === MAX_RECONNECT_ATTEMPTS) {
            console.warn("Maximum socket reconnection attempts reached. WebRTC features may not work.");
            reconnectAttempts++; // Increment to avoid showing this message again
          }
        } else {
          // Reset counter on successful connection
          reconnectAttempts = 0;
        }
      }, 10000); // Check every 10 seconds instead of 5
    }
    
    return () => {
      if (socketCheckInterval) {
        clearInterval(socketCheckInterval);
      }
    };
  }, [authUser]);

  // Create RTCPeerConnection with proper configuration
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
    });
    
    return pc;
  }, []);

  // Initiate a call (from caller side)
  const initiateCall = async (userId, callType = "video") => {
    if (!userId) {
      console.error("Cannot initiate call: missing user ID");
      return;
    }
    
    // Check if socket is available
    if (!socket) {
      console.log("Socket not initialized, attempting to connect");
      if (authUser?._id) {
        try {
          connectSocket(authUser._id);
        } catch (err) {
          console.error("Failed to connect socket:", err);
          alert("Cannot establish connection to the server. Please check if the server is running.");
          return;
        }
      } else {
        console.error("Cannot connect socket: no authenticated user");
        return;
      }
    }
    
    // Check if socket is connected
    if (!socket.connected) {
      console.log("Socket not connected, will attempt call anyway");
    }

    const pc = createPeerConnection();

    peerConnectionRef.current = pc;
    setPeerConnection(pc);

    pc.ontrack = (event) => {
      console.log("Caller received remote stream:", event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallActive(true);
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        console.error(`Call connection state changed to: ${pc.connectionState}`);
        resetCall();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.error("ICE connection failed - restarting ICE");
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        console.log("ICE connection disconnected - waiting for reconnection");
        // Give some time for reconnection before giving up
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            console.error("ICE reconnection failed after timeout");
            resetCall();
          }
        }, 5000); // 5 second timeout for reconnection
      }
    };

    try {
      const constraints =
        callType === "audio"
          ? { audio: true, video: false }
          : { audio: true, video: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setLocalStream(stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call-user", {
        to: userId,
        offer,
        callType,
      });

      setCallType(callType);
      
      // Set timeout for call attempt
      setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.log("Call timeout - no response");
          resetCall();
        }
      }, 30000); // 30 second timeout
    } catch (err) {
      console.error("Error initiating call:", err);
    }
  };

  // Handle reconnection of socket
  useEffect(() => {
    if (!socket) return;
    
    const handleReconnect = () => {
      console.log("Socket reconnected, checking for active call");
      // If we have an active call, we might need to renegotiate
      const pc = peerConnectionRef.current;
      if (pc && pc.connectionState === "connected") {
        console.log("Active call detected after reconnection");
      }
    };
    
    socket.on("connect", handleReconnect);
    
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, []);

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;

    // Incoming call from another user
    socket.on("incoming-call", ({ from, offer, callType }) => {
      setIncomingCall({ from, offer, callType });
    });

    // Callee accepted the call
    socket.on("answer-call", async ({ from, answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        // Check if the remote description is already set
        if (pc.remoteDescription) {
          console.log("Remote description already set, ignoring duplicate answer");
          return;
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process buffered ICE candidates
        while (iceCandidatesBuffer.current.length > 0) {
          const candidate = iceCandidatesBuffer.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        
        console.log("Answer set and buffered candidates processed");
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    });

    // Handle incoming ICE candidates
    socket.on("ice-candidate", async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;

      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("ICE candidate added successfully");
        } else {
          // Store candidate for later processing
          iceCandidatesBuffer.current.push(candidate);
          console.log("ICE candidate buffered - remote description not yet set");
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    // When the other user ends the call
    socket.on("call-ended", () => {
      console.log("Call ended by remote peer");
      const pc = peerConnectionRef.current;
      if (pc) {
        // Close all tracks before closing the connection
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        pc.close();
        peerConnectionRef.current = null;
      }
      resetCall();
    });
    
    // Handle call failures
    socket.on("call-failed", ({ reason }) => {
      console.error("Call failed:", reason);
      resetCall();
    });

    // Handle online users updates
    socket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });



    return () => {
      socket.off("incoming-call");
      socket.off("answer-call");
      socket.off("ice-candidate");
      socket.off("call-ended");
      socket.off("getOnlineUsers");
    };
  }, [setIncomingCall, setPeerConnection, setLocalStream, setRemoteStream, resetCall]);

  // Helper function to restart a failed call
  const restartCall = async (userId, callType) => {
    resetCall();
    // Small delay to ensure cleanup is complete
    setTimeout(() => initiateCall(userId, callType), 1000);
  };
  
  return { initiateCall, restartCall };
};

export default useWebRTC;
