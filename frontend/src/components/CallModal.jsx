// ✅ CallModal.jsx
import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { socket } from "../socket";

const CallModal = () => {
  const {
    incomingCall,
    localStream,
    remoteStream,
    peerConnection,
    callType,
    setIncomingCall,
    setLocalStream,
    setRemoteStream,
    setPeerConnection,
    setCallActive,
    resetCall,
  } = useCallStore();

  const { authUser } = useAuthStore();
  const { selectedUser } = useChatStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceCandidatesBuffer = useRef([]);

  if (!authUser || !authUser._id) return null;

  // Handle ICE candidates for incoming calls
  useEffect(() => {
    if (!socket) return;

    socket.on("ice-candidate", async ({ candidate }) => {
      const pc = peerConnection;
      if (!pc || !candidate) return;

      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesBuffer.current.push(candidate);
        }
      } catch (error) {
        console.error("Error handling ICE candidate in CallModal:", error);
      }
    });

    return () => {
      socket.off("ice-candidate");
    };
  }, [peerConnection]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const endCall = () => {
    const targetUserId = incomingCall?.from || selectedUser?._id;
    if (targetUserId && socket.connected) {
      socket.emit("end-call", { to: targetUserId });
    }
    resetCall();
  };

  const acceptCall = async () => {
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

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setCallActive(true);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: incomingCall.from,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Callee connection state:", pc.connectionState);
      if (pc.connectionState === "failed") {
        console.error("Call connection failed");
        resetCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("Callee ICE connection state:", pc.iceConnectionState);
    };

    const constraints = incomingCall.callType === "audio"
      ? { audio: true, video: false }
      : { audio: true, video: true };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setLocalStream(stream);
      setPeerConnection(pc);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Process any buffered ICE candidates
      while (iceCandidatesBuffer.current.length > 0) {
        const candidate = iceCandidatesBuffer.current.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: incomingCall.from,
        answer,
      });

      setIncomingCall(null);
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  };

  if (!incomingCall && !peerConnection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl w-[90vw] sm:w-[500px] text-center">
        <h2 className="text-xl font-bold">
          {incomingCall ? "Incoming Call..." : `In Call with ${selectedUser?.fullName}`}
        </h2>
        <div className="flex justify-center gap-4 py-4">
          {callType !== "audio" && (
            <>
              <video ref={localVideoRef} autoPlay muted className="w-32 h-32 bg-black rounded-lg" />
              <video ref={remoteVideoRef} autoPlay className="w-32 h-32 bg-black rounded-lg" />
            </>
          )}
        </div>
        <div className="flex justify-center gap-4">
          {incomingCall ? (
            <>
              <button onClick={acceptCall} className="bg-green-600 text-white px-4 py-2 rounded">Accept</button>
              <button onClick={endCall} className="bg-red-600 text-white px-4 py-2 rounded">Reject</button>
            </>
          ) : (
            <button onClick={endCall} className="bg-red-600 text-white px-4 py-2 rounded">End Call</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
