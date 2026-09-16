import React from 'react';
import { X } from 'lucide-react';
import { YoutubeIcon } from './Icons';
import { useStore } from '../../store/useStore';

export const VideoModal: React.FC = () => {
  const { activeVideoId, setActiveVideoId, tutorials } = useStore();

  if (!activeVideoId) return null;

  const currentTutorial = tutorials.find((t) => t.video_id === activeVideoId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={() => setActiveVideoId(null)}
        className="fixed inset-0 bg-dark-950/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-dark-900 border border-cyber-accent/30 rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-dark-950/60">
          <div className="flex items-center gap-2">
            <YoutubeIcon className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-mono font-semibold text-white truncate max-w-lg">
              {currentTutorial?.title || 'YouTube Masterclass'}
            </h3>
          </div>
          <button
            onClick={() => setActiveVideoId(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
            aria-label="Close video player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 16:9 Aspect Ratio Embed */}
        <div className="relative pt-[56.25%] bg-black">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&rel=0`}
            title={currentTutorial?.title || 'Tutorial Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Video Details */}
        {currentTutorial && (
          <div className="p-5 flex flex-wrap items-center justify-between gap-3 bg-dark-950/40 text-xs font-mono text-gray-400">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md bg-cyber-dim border border-cyber-accent/30 text-cyber-neon font-semibold">
                {currentTutorial.category}
              </span>
              {currentTutorial.duration && (
                <span>Duration: {currentTutorial.duration}</span>
              )}
            </div>
            <a
              href={currentTutorial.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyber-neon hover:underline flex items-center gap-1"
            >
              Watch on YouTube &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
