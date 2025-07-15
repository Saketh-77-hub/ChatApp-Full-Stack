import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";
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

  useEffect(() => {
    if (authUser?._id) {
      connectSocket(authUser._id);
    }
  }, [authUser]);



  const initiateCall = async (userId, callType = "video") => {
    if (!socket || !userId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionRef.current = pc;
    setPeerConnection(pc);

    pc.ontrack = (event) => {
      console.log('Caller received remote stream:', event.streams[0]);
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
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallActive(true);
      }
    };

    try {
      const constraints = callType === "audio" 
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
    } catch (err) {
      console.error("Error initiating call:", err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("incoming-call", ({ from, offer, callType }) => {
      setIncomingCall({ from, offer, callType });
    });

    socket.on("call-accepted", async ({ from, answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description set successfully');
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;
      
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    socket.on("call-ended", () => {
      resetCall();
      peerConnectionRef.current = null;
    });

    return () => {
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [setIncomingCall, setPeerConnection, setLocalStream, setRemoteStream, resetCall]);

  return { initiateCall };
};

export default useWebRTC;
