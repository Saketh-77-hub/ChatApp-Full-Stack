import { useEffect, useRef } from "react";
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

  const { authUser } = useAuthStore();
  const peerConnectionRef = useRef(null);
  const iceCandidatesBuffer = useRef([]);

  // Connect socket when authUser is present
  useEffect(() => {
    if (authUser?._id) {
      connectSocket(authUser._id);
    }
  }, [authUser]);

  // Initiate a call (from caller side)
  const initiateCall = async (userId, callType = "video") => {
    if (!socket || !userId) return;

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
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.error("Call connection failed or disconnected");
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
          iceCandidatesBuffer.current.push(candidate);
          console.log("ICE candidate buffered");
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    // When the other user ends the call
    socket.on("call-ended", () => {
      const pc = peerConnectionRef.current;
      if (pc) {
        pc.close();
        peerConnectionRef.current = null;
      }
      resetCall();
    });

    return () => {
      socket.off("incoming-call");
      socket.off("answer-call");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [setIncomingCall, setPeerConnection, setLocalStream, setRemoteStream, resetCall]);

  return { initiateCall };
};

export default useWebRTC;
