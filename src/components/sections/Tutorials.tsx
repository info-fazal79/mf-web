import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Play, Video, ArrowRight, ExternalLink } from 'lucide-react';
import { YoutubeIcon } from '../ui/Icons';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Playlist, PlaylistVideo } from '../../types';

export const Tutorials: React.FC = () => {
  const { playlists, setPlaylists, playlistVideos, setPlaylistVideos } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    async function fetchLivePlaylists() {
      if (!isSupabaseConfigured()) return;
      try {
        const { data: pData } = await supabase.from('playlists').select('*').order('created_at', { ascending: true });
        if (pData) setPlaylists(pData as Playlist[]);
        const { data: vData } = await supabase.from('playlist_videos').select('*').order('order_index', { ascending: true });
        if (vData) setPlaylistVideos(vData as PlaylistVideo[]);
      } catch (err) {
        console.warn('Live fetch for playlists error:', err);
      }
    }
    fetchLivePlaylists();
  }, [setPlaylists, setPlaylistVideos]);

  const categories = ['All', 'MS Office', 'WordPress', 'Automation', 'Data Analysis'];

  const filteredPlaylists = activeCategory === 'All'
    ? playlists
    : playlists.filter((pl) => pl.category === activeCategory);

  return (
    <section id="tutorials" className="py-16 relative bg-dark-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-14">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeCategory === cat
                  ? 'bg-cyber-accent text-dark-950 font-bold shadow-neon-sm'
                  : 'bg-dark-900 text-gray-400 border border-white/10 hover:border-cyber-accent/40 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Playlists Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredPlaylists.map((playlist) => {
            const lectureCount = playlistVideos.filter((v) => v.playlist_id === playlist.id).length || playlist.video_count || 0;

            return (
              <div
                key={playlist.id}
                className="group glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-2xl hover:-translate-y-1"
              >
                <div>
                  {/* Thumbnail Banner with badges */}
                  <Link to={`/tutorials/${playlist.slug}`} className="block relative aspect-[16/9] bg-dark-950 overflow-hidden">
                    <img
                      src={playlist.thumbnail_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop'}
                      alt={playlist.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                    {/* Category Pill */}
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-dark-950/90 backdrop-blur-md border border-cyber-accent/30 text-xs font-mono font-bold text-cyber-neon shadow-neon-sm">
                      {playlist.category}
                    </div>

                    {/* Video Count Badge */}
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-dark-900/90 backdrop-blur-md border border-white/10 text-xs font-mono text-white flex items-center gap-1.5 shadow-md">
                      <Video className="w-3.5 h-3.5 text-cyber-neon" />
                      <span>{lectureCount} Lectures</span>
                    </div>

                    {/* Center Hover Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-2xl bg-cyber-accent/90 text-dark-950 flex items-center justify-center shadow-neon group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-dark-950 ml-0.5" />
                      </div>
                    </div>
                  </Link>

                  {/* Playlist Card Body */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Link to={`/tutorials/${playlist.slug}`}>
                        <h3 className="text-xl font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-1">
                          {playlist.title}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                        {playlist.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Link / Action */}
                <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-white/5 mt-2">
                  <Link
                    to={`/tutorials/${playlist.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs hover:bg-cyber-neon transition-all shadow-neon group/btn"
                  >
                    <span>View Full Course</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                  </Link>

                  {playlist.youtube_playlist_url && (
                    <a
                      href={playlist.youtube_playlist_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-gray-400 hover:text-cyber-neon flex items-center gap-1 transition-colors"
                      title="Open YouTube Playlist"
                    >
                      <YoutubeIcon className="w-4 h-4 text-red-500" />
                      <span className="hidden sm:inline">YouTube</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
