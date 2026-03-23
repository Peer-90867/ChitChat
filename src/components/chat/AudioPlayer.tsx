import React from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface AudioPlayerProps {
  isPlaying: boolean;
  onToggle: () => void;
  isMe: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ isPlaying, onToggle, isMe }) => {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-2xl border transition-all max-w-[280px]",
      isMe 
        ? "bg-indigo-500/20 border-indigo-400/30" 
        : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-white/10"
    )}>
      <button 
        onClick={onToggle}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
          isMe ? "bg-indigo-400/20 text-indigo-300" : "bg-indigo-500/10 text-indigo-500"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i}
              className={cn(
                "w-1 rounded-full transition-all duration-300",
                isPlaying
                  ? (isMe ? "bg-indigo-300" : "bg-indigo-500")
                  : (isMe ? "bg-indigo-400/30" : "bg-slate-300 dark:bg-slate-600")
              )}
              style={{ height: `${Math.random() * 12 + 4}px` }}
            />
          ))}
        </div>
        <div className="text-[10px] font-mono opacity-70">
          {isPlaying ? 'Playing...' : 'Voice Message'}
        </div>
      </div>
    </div>
  );
};
