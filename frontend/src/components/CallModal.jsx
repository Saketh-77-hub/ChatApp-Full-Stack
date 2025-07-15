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
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  if (!authUser || !authUser._id) return null;

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
    if (localStream && localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    console.log('Remote stream updated:', remoteStream);
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) =>
          console.error("Auto-play error:", err)
        );
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) =>
          console.error("Audio auto-play error:", err)
        );
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    const handleICECandidate = async ({ candidate }) => {
      if (candidate && peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      }
    };

    socket.on("ice-candidate", handleICECandidate);
    return () => socket.off("ice-candidate", handleICECandidate);
  }, [peerConnection]);

  const endCall = () => {
    const targetUserId = incomingCall?.from || selectedUser?._id;
    if (targetUserId && socket.connected) {
      socket.emit("end-call", { to: targetUserId });
    }
    resetCall();
  };

  const acceptCall = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.addEventListener("track", (event) => {
      console.log(`Callee received remote ${incomingCall.callType} stream:`, event.streams[0]);
      setRemoteStream(event.streams[0]);
      setCallActive(true);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: incomingCall.from,
          candidate: event.candidate,
        });
      }
    };

    const constraints =
      incomingCall.callType === "audio"
        ? { audio: true, video: false }
        : { audio: true, video: true };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setLocalStream(stream);
      setPeerConnection(pc);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: incomingCall.from,
        answer,
      });

      setCallActive(true);
      setIncomingCall(null);
    } catch (error) {
      console.error("Error in acceptCall:", error);
    }
  };

  if (!incomingCall && !peerConnection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow-xl w-[90vw] sm:w-[500px] text-center space-y-4">
        <h2 className="text-xl font-bold">
          {incomingCall
            ? "Incoming Call..."
            : `In Call with ${selectedUser?.fullName || "User"}`}
        </h2>

        <div className="flex justify-center gap-4">
          {(incomingCall?.callType || callType) !== "audio" ? (
            <>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-32 h-32 bg-black rounded-lg object-cover"
              />
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-32 h-32 bg-black rounded-lg object-cover"
                onLoadedMetadata={() => console.log('Remote video metadata loaded')}
                onCanPlay={() => console.log('Remote video can play')}
              />
            </>
          ) : (
            <div className="flex items-center justify-center w-64 h-32 bg-gray-800 rounded-lg">
              <span className="text-white text-lg">🎵 Audio Call</span>
            </div>
          )}
          <audio ref={localAudioRef} autoPlay muted className="hidden" />
          <audio ref={remoteAudioRef} autoPlay volume={1} className="hidden" />
        </div>

        <div className="flex justify-center gap-4 pt-2">
          {incomingCall ? (
            <>
              <button
                onClick={acceptCall}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Accept
              </button>
              <button
                onClick={endCall}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={endCall}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
