// ✅ CallModal.jsx
import { useEffect, useRef, useState } from "react";
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
  const [connectionStatus, setConnectionStatus] = useState("");
  // Add busy/timeout state
  const [callStatus, setCallStatus] = useState("");
  const callTimeoutRef = useRef(null);

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

  // Cleanup function for peer connection and streams
  const cleanupCall = () => {
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.oniceconnectionstatechange = null;
      peerConnection.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }
    setCallStatus("");
    setConnectionStatus("");
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
      socket.off("ice-candidate");
      socket.off("call-ended");
      socket.off("answer-call");
      socket.off("call-failed");
      socket.off("busy");
      socket.off("call-timeout");
    };
  }, []);

  // Listen for call-ended, call-failed, busy, timeout
  useEffect(() => {
    if (!socket) return;
    socket.on("call-ended", () => {
      setCallStatus("Call ended by other user");
      cleanupCall();
      resetCall();
    });
    socket.on("call-failed", ({ reason }) => {
      setCallStatus(reason || "Call failed");
      cleanupCall();
      resetCall();
    });
    socket.on("busy", () => {
      setCallStatus("User is busy");
      cleanupCall();
      resetCall();
    });
    socket.on("call-timeout", () => {
      setCallStatus("Call timed out");
      cleanupCall();
      resetCall();
    });
    return () => {
      socket.off("call-ended");
      socket.off("call-failed");
      socket.off("busy");
      socket.off("call-timeout");
    };
  }, [socket]);

  // Add call timeout for incoming calls
  useEffect(() => {
    if (incomingCall) {
      callTimeoutRef.current = setTimeout(() => {
        setCallStatus("Missed call");
        socket.emit("call-timeout", { to: incomingCall.from });
        cleanupCall();
        resetCall();
      }, 30000); // 30 seconds
    }
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [incomingCall]);

  const endCall = () => {
    const targetUserId = incomingCall?.from || selectedUser?._id;
    if (targetUserId && socket.connected) {
      socket.emit("end-call", { to: targetUserId });
    }
    cleanupCall();
  };

  const acceptCall = async () => {
    const TURN_SERVERS = [
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
      // Add more TURN servers here as needed
    ];

    const pc = new RTCPeerConnection({
      iceServers: TURN_SERVERS,
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
      setConnectionStatus(pc.connectionState);

      if (pc.connectionState === "connected") {
        setCallActive(true);
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.error("Call connection failed or closed");
        resetCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("Callee ICE connection state:", pc.iceConnectionState);

      if (pc.iceConnectionState === "failed") {
        console.error("ICE connection failed - attempting to restart ICE");
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        console.log("ICE connection disconnected - waiting for reconnection");
        // Give some time for reconnection before giving up
        setTimeout(() => {
          if (
            pc.iceConnectionState === "disconnected" ||
            pc.iceConnectionState === "failed"
          ) {
            console.error("ICE reconnection failed after timeout");
            resetCall();
          }
        }, 5000); // 5 second timeout for reconnection
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

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

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
      setCallStatus("Connecting...");
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  };

  if (!incomingCall && !peerConnection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl w-[90vw] sm:w-[500px] text-center">
        <h2 className="text-xl font-bold">
          {incomingCall
            ? "Incoming Call..."
            : `In Call with ${selectedUser?.fullName}`}
        </h2>
        {connectionStatus && connectionStatus !== "connected" && (
          <p className="text-sm text-gray-500 mt-1">
            {connectionStatus === "connecting"
              ? "Connecting..."
              : connectionStatus === "checking"
              ? "Establishing connection..."
              : connectionStatus === "disconnected"
              ? "Connection interrupted..."
              : connectionStatus === "failed"
              ? "Connection failed"
              : connectionStatus}
          </p>
        )}
        {callStatus && (
          <p className="text-sm text-red-500 mt-1">{callStatus}</p>
        )}
        <div className="flex justify-center gap-4 py-4">
          {callType !== "audio" && (
            <>
              <div className="relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className="w-32 h-32 bg-black rounded-lg object-cover"
                />
                <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                  You
                </span>
              </div>
              <div className="relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  className="w-32 h-32 bg-black rounded-lg object-cover"
                />
                <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                  {selectedUser?.fullName}
                </span>
              </div>
            </>
          )}
          {callType === "audio" && (
            <div className="w-full py-4 flex justify-center items-center">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-2xl text-white">
                  {selectedUser?.fullName?.[0] || "U"}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-4">
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
