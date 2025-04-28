'use client';
import { useEffect, useRef, useState } from 'react';
import Chat from './components/Chat';

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:4000');
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket connection established');
      setConnectionStatus('Connected');
    };

    websocket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnectionStatus('Disconnected');
    };

    // Create peer connection without STUN servers for LAN-only use
    const pc = new RTCPeerConnection({
      iceServers: [] // Empty array means no STUN/TURN servers
    });
    setPeer(pc);

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      setConnectionStatus(pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('Signaling state:', pc.signalingState);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
    };

    websocket.onmessage = async (event) => {
      try {
        let data;
        if (event.data instanceof Blob) {
          data = JSON.parse(await event.data.text());
        } else {
          data = JSON.parse(event.data);
        }
        console.log('Received WebSocket message:', data);

        if (data.type === 'clientCount') {
          setClientCount(data.count);
          return;
        }

        if (data.offer) {
          console.log('Received offer');
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('Sending answer');
          websocket.send(JSON.stringify({ answer }));
        }

        if (data.answer) {
          console.log('Received answer');
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (data.candidate) {
          console.log('Received ICE candidate');
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        websocket.send(JSON.stringify({ candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (remoteVideoRef.current) {
        console.log('Setting remote video source');
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      websocket.close();
      pc.close();
    };
  }, []);

  async function startScreenShare() {
    if (!peer || !ws) return;

    try {
      console.log('Starting screen share...');
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          frameRate: 30,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });

      setStream(mediaStream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      // Remove any existing tracks
      const senders = peer.getSenders();
      senders.forEach(sender => peer.removeTrack(sender));

      // Add new tracks
      mediaStream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.id);
        peer.addTrack(track, mediaStream);
      });

      const offer = await peer.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      console.log('Created offer');
      await peer.setLocalDescription(offer);
      console.log('Sending offer');
      ws.send(JSON.stringify({ offer }));
      
      setIsSharing(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Simple LAN Screen Share</h1>
        
        <div className="mb-4">
          <p className="text-gray-600">Connected clients: {clientCount}</p>
          <p className="text-gray-600">Connection status: {connectionStatus}</p>
        </div>

        <button
          onClick={startScreenShare}
          disabled={isSharing}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
        >
          {isSharing ? 'Screen Sharing Active' : 'Start Screen Share'}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Your Screen</h2>
                <video
                  ref={localVideoRef}
                  autoPlay
                  controls
                  muted
                  playsInline
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">Remote Screen</h2>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  controls
                  muted
                  playsInline
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
          <div>
            <Chat ws={ws} />
          </div>
        </div>
      </div>
    </div>
  );
}
