import React from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  preview: {
    title?: string;
    description?: string;
    image?: string;
    url: string;
  };
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ preview }) => {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block max-w-md overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 group"
    >
      {preview.image && (
        <div className="relative aspect-video w-full overflow-hidden border-b border-slate-200 dark:border-slate-700/50">
          <img
            src={preview.image}
            alt={preview.title || "Link Preview"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 line-clamp-1 group-hover:text-indigo-400 transition-colors">
            {preview.title || new URL(preview.url).hostname}
          </h4>
          <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-400" />
        </div>
        {preview.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate pt-1">
          {new URL(preview.url).hostname}
        </p>
      </div>
    </a>
  );
};
