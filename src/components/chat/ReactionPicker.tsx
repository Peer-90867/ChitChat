import React from 'react';
import { Smile } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Message, Reaction } from '@/src/types';

interface ReactionPickerProps {
  message: Message;
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (reactionId: string) => void;
  currentUserId: string;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ message, onAddReaction, onRemoveReaction, currentUserId }) => {
  const reactions = message.reactions || [];

  const handleEmojiClick = (emoji: string) => {
    const existingReaction = reactions.find(r => r.emoji === emoji && r.user_id === currentUserId);
    if (existingReaction) {
      onRemoveReaction(existingReaction.id);
    } else {
      onAddReaction(emoji);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Existing Reactions */}
      {Object.entries(reactions.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)).map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={() => {
            const reaction = reactions.find(r => r.emoji === emoji && r.user_id === currentUserId);
            if (reaction) onRemoveReaction(reaction.id);
            else onAddReaction(emoji);
          }}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-all",
            reactions.some(r => r.emoji === emoji && r.user_id === currentUserId)
              ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700"
              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          )}
        >
          <span>{emoji}</span>
          <span className="font-medium text-slate-600 dark:text-slate-300">{count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative group">
        <button className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <Smile className="w-4 h-4 text-slate-400" />
        </button>
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex bg-white dark:bg-slate-800 p-1 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
