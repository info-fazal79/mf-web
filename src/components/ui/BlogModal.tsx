import React, { useState } from 'react';
import { X, Calendar, Clock, MessageSquare, Tag, Send, CheckCircle2, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Comment } from '../../types';

export const BlogModal: React.FC = () => {
  const {
    activeBlogPost,
    setActiveBlogPost,
    comments,
    addComment,
    addToast,
  } = useStore();

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeBlogPost) return null;

  // Filter comments belonging to this post that are approved
  const postComments = comments.filter(
    (c) => c.post_id === activeBlogPost.id && c.is_approved
  );

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName || !authorEmail || !commentText) {
      addToast({
        title: 'Missing Fields',
        message: 'Please fill in your name, email, and comment.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    const newComment: Comment = {
      id: 'com-' + Date.now(),
      post_id: activeBlogPost.id,
      author_name: authorName,
      author_email: authorEmail,
      comment_text: commentText,
      is_approved: false, // Subject to admin approval
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('comments').insert([
          {
            post_id: activeBlogPost.id,
            author_name: authorName,
            author_email: authorEmail,
            comment_text: commentText,
            is_approved: false,
          },
        ]);
        if (error) console.error('Supabase comment insert error:', error);
      }

      addComment(newComment);

      addToast({
        title: 'Comment Submitted for Review',
        message: 'Your comment has been queued for moderation and will appear once approved by Fazal.',
        type: 'info',
      });

      setCommentText('');
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={() => setActiveBlogPost(null)}
        className="fixed inset-0 bg-dark-950/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]">
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-dark-950/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-semibold">
              {activeBlogPost.category}
            </span>
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">
              {activeBlogPost.read_time}
            </span>
          </div>
          <button
            onClick={() => setActiveBlogPost(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
            aria-label="Close article"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-8">
          {/* Featured Image */}
          <div className="rounded-xl overflow-hidden border border-white/10 max-h-72">
            <img
              src={activeBlogPost.featured_image}
              alt={activeBlogPost.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title & Metadata */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              {activeBlogPost.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyber-neon" />
                {formatDate(activeBlogPost.created_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyber-neon" />
                {activeBlogPost.read_time}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyber-neon" />
                Muhammad Fazal
              </span>
            </div>
          </div>

          {/* Tags */}
          {activeBlogPost.tags && activeBlogPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
              {activeBlogPost.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-dark-950 border border-white/10 text-gray-300"
                >
                  <Tag className="w-2.5 h-2.5 text-cyber-neon" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Article Text (Rendered Markdown/HTML style) */}
          <div className="prose prose-invert max-w-none text-gray-300 text-sm sm:text-base leading-relaxed space-y-4 border-b border-white/10 pb-8">
            {activeBlogPost.content.split('\n\n').map((paragraph, index) => {
              if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-xl font-bold text-white pt-2 font-mono text-cyber-neon">
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              }
              if (paragraph.startsWith('#### ')) {
                return (
                  <h4 key={index} className="text-lg font-semibold text-white pt-2 font-mono">
                    {paragraph.replace('#### ', '')}
                  </h4>
                );
              }
              return (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* Dynamic Comments Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyber-neon" />
                <span>Discussion ({postComments.length})</span>
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                Admin moderation active
              </span>
            </div>

            {/* Approved Comments List */}
            {postComments.length === 0 ? (
              <p className="text-sm text-gray-400 italic bg-dark-950 p-4 rounded-xl border border-white/5">
                No approved comments yet. Be the first to share your thoughts!
              </p>
            ) : (
              <div className="space-y-3">
                {postComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 rounded-xl bg-dark-950 border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-cyber-neon font-mono">
                        {comment.author_name}
                      </span>
                      <span className="text-gray-500 font-mono">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {comment.comment_text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Comment Form */}
            <form onSubmit={handleCommentSubmit} className="p-5 rounded-xl bg-dark-950/70 border border-white/10 space-y-4">
              <h4 className="text-sm font-semibold text-white font-mono">Leave a Response</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Your Name *"
                  className="px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none"
                />
                <input
                  type="email"
                  required
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="Your Email (Private) *"
                  className="px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none"
                />
              </div>
              <textarea
                rows={3}
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your feedback or question here..."
                className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-white placeholder-gray-500 text-xs focus:border-cyber-accent focus:outline-none resize-none"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-accent text-dark-950 font-mono font-bold text-xs hover:bg-cyber-neon transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Posting...' : 'Submit for Moderation'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
