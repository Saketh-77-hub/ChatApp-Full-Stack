import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { socket } from "../socket";

const useWebRTC = () => {
  const {
    setIncomingCall,
    setPeerConnection,
    setLocalStream,
    setRemoteStream,
    resetCall,
  } = useCallStore();

  const { authUser } = useAuthStore();
  const { selectedUser } = useChatStore();
  const peerConnectionRef = useRef(null);

  const initiateCall = async (userId, callType = 'video') => {
    if (!authUser || !socket.connected) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    try {
      const constraints = callType === 'audio' 
        ? { audio: true, video: false }
        : { audio: true, video: true };
        
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setLocalStream(stream);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      peerConnectionRef.current = pc;
      setPeerConnection(pc);
      
      socket.emit("initiate-call", {
        to: userId,
        offer,
        callType
      });
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  };

  useEffect(() => {
    if (!authUser || !socket) return;

    // Handle incoming call
    socket.on("incoming-call", ({ from, offer, callType }) => {
      setIncomingCall({ from, offer, callType });
    });

    // When other user accepts the call
    socket.on("call-accepted", async ({ from, answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    });

    // ICE candidate exchange
    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed to add ICE candidate", err);
      }
    });

    // Call ended
    socket.on("call-ended", ({ from }) => {
      const pc = peerConnectionRef.current;
      if (pc) {
        pc.close();
        peerConnectionRef.current = null;
      }
      resetCall();
    });

    return () => {
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [authUser, setIncomingCall, setPeerConnection, setLocalStream, setRemoteStream, resetCall]);

  return { initiateCall };
};

export default useWebRTC;
