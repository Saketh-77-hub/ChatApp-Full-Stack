import { useEffect, useRef, useCallback } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { getSocket, isSocketConnected } from "../socket";

const useWebRTC = () => {
  const {
    incomingCall,
    setIncomingCall,
    setPeerConnection,
    setLocalStream,
    setRemoteStream,
    setCallActive,
    setCallType,
    resetCall,
  } = useCallStore();

  const { authUser } = useAuthStore();
  const peerConnectionRef = useRef(null);
  const iceCandidatesBuffer = useRef([]);
  const localStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, []);

  // Create RTCPeerConnection with proper configuration
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
    });
    
    pc.ontrack = (event) => {
      console.log("🎥 Received remote stream");
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && getSocket()?.connected) {
        const currentCall = incomingCall || { from: null };
        const targetUserId = currentCall.from || peerConnectionRef.current?.targetUserId;
        if (targetUserId) {
          getSocket().emit("ice-candidate", {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallActive(true);
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
      } else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        resetCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("❄️ ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };
    
    return pc;
  }, [incomingCall, setRemoteStream, setCallActive, resetCall]);

  // Initiate a call (from caller side)
  const initiateCall = async (userId, callType = "video") => {
    if (!userId) {
      console.error("Cannot initiate call: missing user ID");
      return;
    }
    
    if (!isSocketConnected()) {
      console.error("Cannot initiate call: socket not connected");
      alert("Connection lost. Please refresh the page and try again.");
      return;
    }

    try {
      const constraints = callType === "audio" 
        ? { audio: true, video: false }
        : { audio: true, video: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection();
      pc.targetUserId = userId;
      peerConnectionRef.current = pc;
      setPeerConnection(pc);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      getSocket().emit("call-user", {
        to: userId,
        offer,
        callType,
      });

      setCallType(callType);
      
      // Extended call timeout (5 minutes instead of 30 seconds)
      callTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.log("⏰ Call connection timeout after 5 minutes");
          resetCall();
        }
      }, 300000);
    } catch (err) {
      console.error("❌ Error initiating call:", err);
      resetCall();
    }
  };

  // Answer incoming call
  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      const constraints = incomingCall.callType === "audio"
        ? { audio: true, video: false }
        : { audio: true, video: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection();
      pc.targetUserId = incomingCall.from;
      peerConnectionRef.current = pc;
      setPeerConnection(pc);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Process buffered ICE candidates
      while (iceCandidatesBuffer.current.length > 0) {
        const candidate = iceCandidatesBuffer.current.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      getSocket().emit("answer-call", {
        to: incomingCall.from,
        answer,
      });

      setCallType(incomingCall.callType);
      setIncomingCall(null);
    } catch (err) {
      console.error("❌ Error answering call:", err);
      resetCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall) {
      getSocket().emit("reject-call", { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  // End active call
  const endCall = () => {
    const pc = peerConnectionRef.current;
    if (pc?.targetUserId) {
      getSocket().emit("end-call", { to: pc.targetUserId });
    }
    resetCall();
  };

  // Handle incoming socket events
  useEffect(() => {
    const currentSocket = getSocket();
    if (!currentSocket) return;

    const handleIncomingCall = ({ from, offer, callType }) => {
      console.log("📞 Incoming call from:", from);
      setIncomingCall({ from, offer, callType });
    };

    const handleAnswerCall = async ({ from, answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc || pc.remoteDescription) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process buffered ICE candidates
        while (iceCandidatesBuffer.current.length > 0) {
          const candidate = iceCandidatesBuffer.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        
        console.log("✅ Answer processed successfully");
      } catch (error) {
        console.error("❌ Error processing answer:", error);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;

      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesBuffer.current.push(candidate);
        }
      } catch (error) {
        console.error("❌ Error adding ICE candidate:", error);
      }
    };

    const handleCallEnded = () => {
      console.log("📞 Call ended by remote peer");
      resetCall();
    };

    const handleCallRejected = () => {
      console.log("❌ Call rejected");
      resetCall();
    };

    const handleCallFailed = ({ reason }) => {
      console.error("❌ Call failed:", reason);
      resetCall();
    };

    currentSocket.on("incoming-call", handleIncomingCall);
    currentSocket.on("answer-call", handleAnswerCall);
    currentSocket.on("ice-candidate", handleIceCandidate);
    currentSocket.on("call-ended", handleCallEnded);
    currentSocket.on("call-rejected", handleCallRejected);
    currentSocket.on("call-failed", handleCallFailed);

    return () => {
      currentSocket.off("incoming-call", handleIncomingCall);
      currentSocket.off("answer-call", handleAnswerCall);
      currentSocket.off("ice-candidate", handleIceCandidate);
      currentSocket.off("call-ended", handleCallEnded);
      currentSocket.off("call-rejected", handleCallRejected);
      currentSocket.off("call-failed", handleCallFailed);
    };
  }, [setIncomingCall, resetCall]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    iceCandidatesBuffer.current = [];
  }, []);

  // Override resetCall to include cleanup
  const resetCallWithCleanup = useCallback(() => {
    cleanup();
    resetCall();
  }, [cleanup, resetCall]);

  // Update resetCall references
  useEffect(() => {
    const originalReset = resetCall;
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  return { 
    initiateCall, 
    answerCall, 
    rejectCall, 
    endCall,
    resetCall: resetCallWithCleanup
  };
};

export default useWebRTC;
