import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast = ({ message, type, onClose }: ToastProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={cn(
        "fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl min-w-[300px] max-w-md",
        type === 'success' 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
          : "bg-red-500/10 border-red-500/20 text-red-400"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
        type === 'success' ? "bg-emerald-500/20" : "bg-red-500/20"
      )}>
        {type === 'success' ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold leading-tight">{type === 'success' ? 'Success' : 'Error'}</p>
        <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{message}</p>
      </div>
      <button 
        onClick={onClose}
        className="p-1 hover:bg-white/5 rounded-lg transition-colors"
      >
        <X className="w-4 h-4 opacity-50 hover:opacity-100" />
      </button>
    </motion.div>
  );
};
