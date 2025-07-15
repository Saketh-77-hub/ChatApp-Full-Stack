// store/useCallStore.js
import { create } from "zustand";

export const useCallStore = create((set, get) => ({
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isCallActive: false,
  callType: null,

  setIncomingCall: (call) => set({ incomingCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  setCallActive: (active) => set({ isCallActive: active }),
  setCallType: (type) => set({ callType: type }),
  
  resetCall: () => {
    const { localStream, peerConnection } = get();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    set({ 
      incomingCall: null, 
      localStream: null, 
      remoteStream: null, 
      peerConnection: null,
      isCallActive: false,
      callType: null
    });
  },
}));
