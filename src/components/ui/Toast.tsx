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
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      className={cn(
        "z-[100] flex flex-col gap-0 rounded-2xl shadow-2xl border backdrop-blur-xl min-w-[320px] max-w-md overflow-hidden",
        type === 'success' 
          ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" 
          : "bg-red-950/40 border-red-500/30 text-red-400"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
          type === 'success' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        )}>
          {type === 'success' ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <AlertCircle className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 pr-2">
          <p className="text-sm font-bold tracking-tight uppercase opacity-60 mb-0.5">
            {type === 'success' ? 'Operation Success' : 'System Error'}
          </p>
          <p className="text-[13px] font-medium leading-relaxed text-slate-200">
            {message}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-full transition-all active:scale-90 flex-shrink-0"
        >
          <X className="w-4 h-4 opacity-50 hover:opacity-100" />
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1 w-full bg-white/5">
        <motion.div 
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 3, ease: "linear" }}
          className={cn(
            "h-full",
            type === 'success' ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      </div>
    </motion.div>
  );
};
