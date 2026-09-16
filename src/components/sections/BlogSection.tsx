import React from 'react';
import { useStore } from '../../store/useStore';
import { formatDate } from '../../lib/utils';
import { Calendar, Clock, ArrowRight, MessageSquare, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BlogSection: React.FC = () => {
  const { posts, comments } = useStore();

  const publishedPosts = posts.filter((p) => p.published);

  return (
    <section id="blog" className="py-24 relative bg-dark-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
              Knowledge Base
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans mt-2">
              Insights, Articles & Case Studies
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon hover:underline"
          >
            <span>View All Articles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {publishedPosts.map((post) => {
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
                        {postCommentsCount}
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
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon group-hover:translate-x-1 transition-transform">
                      <span>Read Article</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
