import React from 'react';
import { cn } from '@/src/lib/utils';

export const Logo = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={cn("w-6 h-6", className)}
  >
    {/* Back bubble */}
    <path 
      d="M 65 30 C 87.09 30 105 47.91 105 70 C 105 79.6 101.6 88.4 95.9 95.2 L 103 110 L 86.5 104.6 C 80 108 72.8 110 65 110 C 42.91 110 25 92.09 25 70" 
      fill="currentColor" 
      stroke="#0084ff" 
      strokeWidth="8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="text-white dark:text-slate-900"
    />
    {/* Front bubble */}
    <path 
      d="M 50 10 C 27.91 10 10 27.91 10 50 C 10 59.6 13.4 68.4 19.1 75.2 L 12 90 L 28.5 84.6 C 35 88 42.2 90 50 90 C 72.09 90 90 72.09 90 50 C 90 27.91 72.09 10 50 10 Z" 
      fill="#0084ff"
    />
    {/* Dots */}
    <circle cx="30" cy="50" r="6" fill="currentColor" className="text-white dark:text-slate-900"/>
    <circle cx="50" cy="50" r="6" fill="currentColor" className="text-white dark:text-slate-900"/>
    <circle cx="70" cy="50" r="6" fill="currentColor" className="text-white dark:text-slate-900"/>
  </svg>
);
