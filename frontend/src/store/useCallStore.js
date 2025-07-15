// store/useCallStore.js
import { create } from "zustand";

export const useCallStore = create((set) => ({
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,

  setIncomingCall: (call) => set({ incomingCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  resetCall: () => set({ incomingCall: null, localStream: null, remoteStream: null, peerConnection: null }),
}));
