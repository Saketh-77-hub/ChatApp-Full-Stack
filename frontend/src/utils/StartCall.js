import { socket } from "../socket";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

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

  if (!authUser || !selectedUser) return;

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
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
    } else if (pc.connectionState === "failed") {
      console.error("Call connection failed");
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
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

    // Wait for answer
    socket.on("answer-call", async ({ answer }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setCallActive(true);
        console.log(`Caller set remote description for ${callType} call`);
      } catch (err) {
        console.error("Caller failed to set remote description:", err);
      }
    });
  } catch (err) {
    console.error("Error in startCall:", err);
  }
};
