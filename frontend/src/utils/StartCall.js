import { socket } from "../socket";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

// Helper function to create a peer connection with consistent config
const createPeerConnection = () => {
  return new RTCPeerConnection({
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
};

export const startCall = async (callType = "video") => {
  const {
    setLocalStream,
    setRemoteStream,
    setPeerConnection,
    setCallActive,
    setCallType,
  } = useCallStore.getState();
  const { authUser } = useAuthStore.getState();
  const { selectedUser } = useChatStore.getState();

  if (!authUser || !selectedUser) {
    console.error("Cannot start call: missing user information");
    return;
  }
  
  if (!socket || !socket.connected) {
    console.error("Cannot start call: socket not connected");
    return;
  }

  const pc = createPeerConnection();

  // Handle local ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: selectedUser._id,
        candidate: event.candidate,
      });
    }
  };

  // When remote user adds track, save it to state
  pc.ontrack = (event) => {
    console.log(`Caller received remote ${callType} stream:`, event.streams[0]);
    setRemoteStream(event.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
    if (pc.connectionState === "connected") {
      setCallActive(true);
    } else if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
      console.error(`Call connection state changed to: ${pc.connectionState}`);
      if (pc.connectionState === "failed") {
        // Clean up the failed connection
        const { resetCall } = useCallStore.getState();
        resetCall();
      }
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      console.error("ICE connection failed - attempting to restart ICE");
      pc.restartIce();
    } else if (pc.iceConnectionState === "disconnected") {
      console.log("ICE connection disconnected - waiting for reconnection");
      // Give some time for reconnection before giving up
      setTimeout(() => {
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          console.error("ICE reconnection failed after timeout");
          const { resetCall } = useCallStore.getState();
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

    // Get local media stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    setLocalStream(stream);
    setPeerConnection(pc);
    setCallType(callType);

    // Create and send offer to callee
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call-user", {
      to: selectedUser._id,
      offer,
      callType,
    });

    // Set up a timeout for call attempt
    const callTimeout = setTimeout(() => {
      if (pc.connectionState !== "connected") {
        console.log("Call timeout - no response");
        const { resetCall } = useCallStore.getState();
        resetCall();
        socket.off("answer-call"); // Clean up the listener
      }
    }, 30000); // 30 second timeout
    
    // Wait for answer
    const handleAnswer = async ({ answer }) => {
      try {
        clearTimeout(callTimeout); // Clear the timeout since we got an answer
        
        if (pc.remoteDescription) {
          console.log("Remote description already set, ignoring duplicate answer");
          return;
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setCallActive(true);
        console.log(`Caller set remote description for ${callType} call`);
      } catch (err) {
        console.error("Caller failed to set remote description:", err);
      }
    };
    
    socket.on("answer-call", handleAnswer);
    
    // Clean up function to remove event listener
    return () => {
      socket.off("answer-call", handleAnswer);
      clearTimeout(callTimeout);
    };
  } catch (err) {
    console.error("Error in startCall:", err);
  }
};
