import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { formatDate } from '../lib/utils';
import { Calendar, Clock, ArrowRight, MessageSquare, Search, BookOpen, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BlogPage: React.FC = () => {
  const { posts, comments } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const publishedPosts = posts.filter((p) => p.published);

  // Extract unique categories
  const categories = ['All', ...Array.from(new Set(publishedPosts.map((p) => p.category)))];

  const filteredPosts = publishedPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.summary && post.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (post.tags && post.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pt-24 space-y-0">
      {/* Page Header Banner */}
      <section className="py-16 relative bg-dark-950 border-b border-white/5 cyber-grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Base & Articles</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Tech Insights & Case Studies
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Practical breakdowns, architectural philosophies, and productivity engineering strategies from real enterprise deployments.
          </p>
        </div>
      </section>

      {/* Main Blog List Section with Search & Filter */}
      <section className="py-16 relative bg-dark-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-white/5">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search articles or topics..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    selectedCategory === cat
                      ? 'bg-cyber-accent text-dark-950 font-bold shadow-neon-sm'
                      : 'bg-dark-900 text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          {filteredPosts.length === 0 ? (
            <div className="glass-panel p-16 rounded-2xl border border-white/10 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-lg font-bold text-white font-mono">No Articles Found</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                No matching posts were found for "{searchTerm}". Try clearing your search or switching categories.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl bg-dark-900 text-cyber-neon text-xs font-mono border border-cyber-accent/30"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => {
                const postCommentsCount = comments.filter(
                  (c) => c.post_id === post.id && c.is_approved
                ).length;

                return (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug || post.id}`}
                    className="group glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 overflow-hidden flex flex-col justify-between hover:-translate-y-1.5 shadow-2xl"
                  >
                    {/* Featured Image */}
                    <div className="relative aspect-[16/9] bg-dark-950 overflow-hidden border-b border-white/10">
                      <img
                        src={post.featured_image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 rounded-full bg-dark-950/90 backdrop-blur-md border border-cyber-accent/40 text-cyber-neon text-xs font-mono font-bold">
                          {post.category}
                        </span>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyber-neon" />
                            {formatDate(post.created_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyber-neon" />
                            {post.read_time}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-cyber-neon" />
                            {postCommentsCount} Comments
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white font-sans group-hover:text-cyber-neon transition-colors line-clamp-2">
                          {post.title}
                        </h3>

                        <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                          {post.summary || post.content.slice(0, 150) + '...'}
                        </p>
                      </div>

                      {/* Read Article Link */}
                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {post.tags?.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-400 flex items-center gap-1"
                            >
                              <Tag className="w-2.5 h-2.5 text-cyber-neon" />
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>

                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon group-hover:translate-x-1 transition-transform">
                          <span>Read Full Article</span>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
