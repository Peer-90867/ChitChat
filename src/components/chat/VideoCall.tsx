import React, { useEffect, useRef } from 'react';
import { PhoneOff } from 'lucide-react';

interface VideoCallProps {
  roomUrl: string;
  onLeave: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomUrl, onLeave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadJitsiScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).JitsiMeetExternalAPI) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Jitsi script'));
        document.body.appendChild(script);
      });
    };

    loadJitsiScript()
      .then(() => {
        if (!isMounted || !containerRef.current) return;

        const domain = 'meet.jit.si';
        const options = {
          roomName: roomUrl,
          width: '100%',
          height: '100%',
          parentNode: containerRef.current,
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
              'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
              'security'
            ],
          },
        };

        const api = new (window as any).JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;

        api.addListener('videoConferenceLeft', () => {
          onLeave();
        });
        
        api.addListener('readyToClose', () => {
          onLeave();
        });
      })
      .catch(console.error);

    return () => {
      isMounted = false;
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomUrl, onLeave]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col">
      <div ref={containerRef} className="flex-1 w-full h-full" />
      <button
        onClick={onLeave}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center gap-2 transition-colors z-[1001]"
      >
        <PhoneOff className="w-5 h-5" />
        <span className="font-medium">Leave Call</span>
      </button>
    </div>
  );
};

