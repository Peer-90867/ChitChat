import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface VideoCallProps {
  roomUrl: string;
  onLeave: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomUrl, onLeave }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const callFrameRef = useRef<any>(null);

  useEffect(() => {
    const callFrame = DailyIframe.createFrame({
      showLeaveButton: true,
      iframeStyle: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        border: '0',
        zIndex: '1000',
      },
    });

    callFrameRef.current = callFrame;

    callFrame.join({ url: roomUrl });

    const updateParticipants = () => {
      setParticipants(Object.values(callFrame.participants()));
    };

    callFrame.on('left-meeting', onLeave);
    callFrame.on('participant-updated', updateParticipants);
    callFrame.on('participant-joined', updateParticipants);
    callFrame.on('participant-left', updateParticipants);

    return () => {
      callFrame.destroy();
    };
  }, [roomUrl, onLeave]);

  const toggleMute = () => {
    const callFrame = callFrameRef.current;
    if (callFrame) {
      callFrame.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const callFrame = callFrameRef.current;
    if (callFrame) {
      callFrame.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = () => {
    const callFrame = callFrameRef.current;
    if (callFrame) {
      if (isScreenSharing) {
        callFrame.stopScreenShare();
      } else {
        callFrame.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    }
  };

  const leaveCall = () => {
    const callFrame = callFrameRef.current;
    if (callFrame) {
      callFrame.leave();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1001] flex flex-col gap-2">
      <div className="bg-slate-900 p-2 rounded-xl shadow-lg flex gap-2">
        <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700">
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={toggleVideo} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700">
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>
        <button onClick={toggleScreenShare} className={cn("p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700", isScreenSharing && "bg-indigo-600")}>
          <Monitor className="w-5 h-5" />
        </button>
        <button onClick={leaveCall} className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
      <div className="bg-slate-900/80 p-2 rounded-xl shadow-lg text-white text-xs">
        {participants.map(p => (
          <div key={p.session_id} className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", p.audio ? "bg-emerald-500" : "bg-red-500")} />
            {p.user_name || 'Guest'} {p.audio ? '' : '(Muted)'}
          </div>
        ))}
      </div>
    </div>
  );
};
