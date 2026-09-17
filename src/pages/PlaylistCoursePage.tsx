import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Playlist, PlaylistVideo } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  ArrowLeft, 
  Play, 
  Clock, 
  Video, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { YoutubeIcon } from '../components/ui/Icons';

export const PlaylistCoursePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { playlists, setPlaylists, playlistVideos, setPlaylistVideos } = useStore();

  useEffect(() => {
    async function fetchCourseData() {
      if (!isSupabaseConfigured()) return;
      try {
        const { data: pData } = await supabase.from('playlists').select('*').order('created_at', { ascending: true });
        if (pData) setPlaylists(pData as Playlist[]);
        const { data: vData } = await supabase.from('playlist_videos').select('*').order('order_index', { ascending: true });
        if (vData) setPlaylistVideos(vData as PlaylistVideo[]);
      } catch (err) {
        console.warn('Live fetch for playlist course error:', err);
      }
    }
    fetchCourseData();
  }, [setPlaylists, setPlaylistVideos]);

  // Find playlist by slug
  const playlist = playlists.find((p) => p.slug === slug);

  // Active playing lecture in player modal / theater
  const [activeLecture, setActiveLecture] = useState<PlaylistVideo | null>(null);

  if (!playlist) {
    return <Navigate to="/tutorials" replace />;
  }

  // Get all lectures belonging to this playlist, sorted by order_index
  const lectures = playlistVideos
    .filter((v) => v.playlist_id === playlist.id)
    .sort((a, b) => a.order_index - b.order_index);

  // Next / Previous Lecture navigation
  const currentIndex = activeLecture 
    ? lectures.findIndex((l) => l.id === activeLecture.id) 
    : -1;

  const handlePrevLecture = () => {
    if (currentIndex > 0) {
      setActiveLecture(lectures[currentIndex - 1]);
    }
  };

  const handleNextLecture = () => {
    if (currentIndex < lectures.length - 1 && currentIndex >= 0) {
      setActiveLecture(lectures[currentIndex + 1]);
    }
  };

  return (
    <div className="pt-24 min-h-screen pb-24">
      {/* Course Header Banner */}
      <section className="py-14 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          {/* Back Link */}
          <Link
            to="/tutorials"
            className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyber-neon transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to All Courses & Workshops</span>
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
                  {playlist.category}
                </span>
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-cyber-neon" />
                  <span>{lectures.length} Lectures Included</span>
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-sans">
                {playlist.title}
              </h1>

              <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                {playlist.description}
              </p>
            </div>

            {/* Quick Action / External Playlist */}
            {playlist.youtube_playlist_url && (
              <div className="shrink-0">
                <a
                  href={playlist.youtube_playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-dark-900 border border-white/10 hover:border-cyber-accent/40 text-white hover:text-cyber-neon text-xs font-mono transition-all shadow-xl"
                >
                  <YoutubeIcon className="w-4 h-4 text-red-500" />
                  <span>Open on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 text-gray-400" />
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Course Content: Lectures Grid & List */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <span>Curriculum & Lectures</span>
            <span className="text-xs font-normal text-gray-400">({lectures.length} total)</span>
          </h2>
          <span className="text-xs font-mono text-cyber-neon">
            Click any lecture to start watching
          </span>
        </div>

        {lectures.length === 0 ? (
          <div className="glass-panel p-16 text-center rounded-2xl border border-white/10 space-y-3">
            <Video className="w-10 h-10 text-gray-500 mx-auto" />
            <h3 className="text-lg font-bold text-white font-mono">No lectures available</h3>
            <p className="text-xs text-gray-400">
              Lectures are currently being organized for this playlist course. Check back shortly!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lectures.map((lecture) => {
              const isPlaying = activeLecture?.id === lecture.id;

              return (
                <div
                  key={lecture.id}
                  onClick={() => setActiveLecture(lecture)}
                  className={`group glass-panel rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between hover:-translate-y-1 shadow-xl ${
                    isPlaying 
                      ? 'border-cyber-accent bg-dark-900/90 shadow-neon-sm' 
                      : 'border-white/10 hover:border-cyber-accent/40 bg-dark-950/60'
                  }`}
                >
                  {/* Thumbnail Banner */}
                  <div className="relative aspect-video bg-dark-950 overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${lecture.youtube_video_id}/hqdefault.jpg`}
                      alt={lecture.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-dark-950/40 group-hover:bg-dark-950/20 transition-colors" />

                    {/* Order Index Pill */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-dark-950/90 backdrop-blur-md border border-cyber-accent/30 text-xs font-mono font-bold text-cyber-neon">
                      #{lecture.order_index}
                    </div>

                    {/* Duration Badge */}
                    {lecture.duration && (
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-dark-950/90 backdrop-blur-md text-[10px] font-mono text-gray-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyber-neon" />
                        <span>{lecture.duration}</span>
                      </div>
                    )}

                    {/* Center Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-cyber-accent text-dark-950 flex items-center justify-center shadow-neon group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-dark-950 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Lecture Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono text-gray-400">
                        Lecture #{lecture.order_index}
                      </div>
                      <h3 className="text-sm font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-2">
                        {lecture.title}
                      </h3>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                      <span className="text-cyber-neon flex items-center gap-1 group-hover:underline">
                        <span>Play Video</span>
                      </span>
                      <YoutubeIcon className="w-4 h-4 text-red-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SLEEK 16:9 EMBEDDED YOUTUBE VIDEO PLAYER MODAL */}
      {activeLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div
            onClick={() => setActiveLecture(null)}
            className="fixed inset-0 bg-dark-950/90 backdrop-blur-md transition-opacity"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-5xl bg-dark-900 border border-cyber-accent/30 rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in flex flex-col">
            {/* Modal Header Bar */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-dark-950/80">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded bg-cyber-dim border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-bold shrink-0">
                  #{activeLecture.order_index}
                </span>
                <h3 className="text-sm sm:text-base font-sans font-bold text-white truncate">
                  {activeLecture.title}
                </h3>
              </div>

              <button
                onClick={() => setActiveLecture(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors ml-4 shrink-0"
                aria-label="Close video player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 16:9 Aspect Ratio Embed */}
            <div className="relative pt-[56.25%] bg-black">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${activeLecture.youtube_video_id}?autoplay=1&rel=0&modestbranding=1`}
                title={activeLecture.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Video Controls & Playlist Navigation */}
            <div className="p-4 sm:p-5 bg-dark-950/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-4 text-gray-400">
                <span className="text-white font-semibold">{playlist.title}</span>
                <span>•</span>
                <span>Lesson {currentIndex + 1} of {lectures.length}</span>
                {activeLecture.duration && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyber-neon" />
                      {activeLecture.duration}
                    </span>
                  </>
                )}
              </div>

              {/* Prev / Next Lecture Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevLecture}
                  disabled={currentIndex <= 0}
                  className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-mono transition-all ${
                    currentIndex > 0
                      ? 'bg-dark-900 border border-white/10 text-white hover:text-cyber-neon hover:border-cyber-accent/40'
                      : 'opacity-40 cursor-not-allowed text-gray-600 bg-dark-950'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={handleNextLecture}
                  disabled={currentIndex >= lectures.length - 1}
                  className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                    currentIndex < lectures.length - 1
                      ? 'bg-cyber-accent text-dark-950 hover:bg-cyber-neon shadow-neon-sm'
                      : 'opacity-40 cursor-not-allowed text-gray-600 bg-dark-950'
                  }`}
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
