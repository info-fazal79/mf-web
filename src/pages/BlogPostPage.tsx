import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatDate } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Comment } from '../types';
import { 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles,
  Share2
} from 'lucide-react';

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, comments, addComment, addToast } = useStore();

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find post by slug or id
  const post = posts.find((p) => p.slug === slug || p.id === slug);

  if (!post) {
    return (
      <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white font-mono">Article Not Found</h2>
        <p className="text-gray-400 text-sm">The requested article could not be found.</p>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-accent text-dark-950 font-bold font-mono text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Articles</span>
        </Link>
      </div>
    );
  }

  // Filter approved comments for this post
  const postComments = comments.filter(
    (c) => c.post_id === post.id && c.is_approved
  );

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName || !authorEmail || !commentText) {
      addToast({
        title: 'Missing Fields',
        message: 'Please provide your name, email, and feedback.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    const newComment: Comment = {
      id: 'com-' + Date.now(),
      post_id: post.id,
      author_name: authorName,
      author_email: authorEmail,
      comment_text: commentText,
      is_approved: false, // Moderation queue
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('comments').insert([
          {
            post_id: post.id,
            author_name: authorName,
            author_email: authorEmail,
            comment_text: commentText,
            is_approved: false,
          },
        ]);
        if (error) console.error('Supabase comment error:', error);
      }

      addComment(newComment);
      addToast({
        title: 'Comment Submitted',
        message: 'Your comment was received and will appear after moderation.',
        type: 'info',
      });

      setCommentText('');
    } catch (err) {
      console.error('Comment submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast({
      title: 'Link Copied',
      message: 'Article link copied to clipboard.',
      type: 'success',
    });
  };

  return (
    <article className="pt-28 pb-24 relative bg-dark-950">
      {/* Article Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyber-neon transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Articles</span>
          </Link>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 border border-white/10 text-xs font-mono text-gray-300 hover:text-cyber-neon hover:border-cyber-accent transition-all"
            title="Share article link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>

        {/* Header Content */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold">
            {post.category}
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight font-sans">
            {post.title}
          </h1>

          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-400 pt-2 border-y border-white/5 py-3">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyber-neon" />
              <span>Muhammad Fazal</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyber-neon" />
              <span>{formatDate(post.created_at)}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyber-neon" />
              <span>{post.read_time}</span>
            </span>
          </div>
        </div>

        {/* Featured Banner Image */}
        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl max-h-[460px] bg-dark-900">
          <img
            src={post.featured_image}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Formatted Article Body */}
        <div className="prose prose-invert max-w-none text-gray-200 text-base sm:text-lg leading-relaxed space-y-6 pt-4 border-b border-white/10 pb-12">
          {post.content.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('### ')) {
              return (
                <h3 key={index} className="text-2xl sm:text-3xl font-bold text-white pt-6 font-mono text-cyber-neon">
                  {paragraph.replace('### ', '')}
                </h3>
              );
            }
            if (paragraph.startsWith('#### ')) {
              return (
                <h4 key={index} className="text-xl sm:text-2xl font-semibold text-white pt-4 font-mono">
                  {paragraph.replace('#### ', '')}
                </h4>
              );
            }
            if (paragraph.startsWith('- ')) {
              const bullets = paragraph.split('\n');
              return (
                <ul key={index} className="space-y-2 pl-4">
                  {bullets.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2 text-sm sm:text-base text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent mt-2 shrink-0" />
                      <span>{b.replace(/^[-\*]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={index} className="whitespace-pre-line text-gray-300">
                {paragraph}
              </p>
            );
          })}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-mono text-gray-500 uppercase mr-1">Tags:</span>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-xs font-mono px-3 py-1 rounded-lg bg-dark-900 border border-white/10 text-gray-300"
              >
                <Tag className="w-3 h-3 text-cyber-neon" />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {/* Author Bio Box */}
        <div className="p-6 sm:p-8 rounded-2xl bg-dark-900 border border-white/10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-cyber-accent/40 shrink-0 shadow-neon-sm">
            <img
              src="/fazal.jpg"
              alt="Muhammad Fazal"
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h4 className="text-lg font-bold text-white font-mono">Muhammad Fazal</h4>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                AUTHOR
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              WordPress Developer (Fiverr Level 1), Data Analyst, and Lead Instructor of MS Office at As-Sunnah Skill Development Institute. Passionate about speed optimization and workflow automation.
            </p>
          </div>
        </div>

        {/* Dynamic Comments & Discussion */}
        <div className="space-y-8 pt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyber-neon" />
              <span>Discussion & Responses ({postComments.length})</span>
            </h3>
            <span className="text-xs text-gray-500 font-mono">Admin Moderated</span>
          </div>

          {/* Comments List */}
          {postComments.length === 0 ? (
            <p className="text-sm text-gray-400 italic bg-dark-900 p-6 rounded-2xl border border-white/5">
              No approved comments yet. Be the first to share your thoughts or questions!
            </p>
          ) : (
            <div className="space-y-4">
              {postComments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-5 rounded-2xl bg-dark-900 border border-white/5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-cyber-neon">{comment.author_name}</span>
                    <span className="text-gray-500">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {comment.comment_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Submit Comment Form */}
          <form onSubmit={handleCommentSubmit} className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-white/10 space-y-4">
            <h4 className="text-base font-bold text-white font-mono">Join the Discussion</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Your Email (Will remain private) *
                </label>
                <input
                  type="email"
                  required
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="sarah@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Your Comment / Feedback *
              </label>
              <textarea
                rows={4}
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your thoughts, ask a technical question, or propose ideas..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyber-accent text-dark-950 font-mono font-bold text-xs hover:bg-cyber-neon transition-all shadow-neon disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Submit for Review'}</span>
            </button>
          </form>
        </div>
      </div>
    </article>
  );
};
