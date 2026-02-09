import { useEffect, useRef, useState } from "react";

export const useWebRTC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const setupWebRTC = async () => {
      try {
        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConnectionRef.current = peerConnection;

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            // Send candidate to remote peer
          }
        };

        peerConnection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
        };

        // Add local stream tracks to the connection
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });
      } catch (error) {
        console.error("Error setting up WebRTC:", error);
      }
    };

    setupWebRTC();
  }, []);

  return { isConnected, remoteStream };
};
