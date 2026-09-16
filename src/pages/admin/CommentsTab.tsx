import React from 'react';
import { useStore } from '../../store/useStore';
import { MessageSquare, Check, X, Trash2, Mail, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

export const CommentsTab: React.FC = () => {
  const { comments, posts, toggleApproveComment, deleteComment, addToast } = useStore();

  const handleToggle = async (id: string, currentApproved: boolean) => {
    toggleApproveComment(id);
    if (isSupabaseConfigured()) {
      await supabase.from('comments').update({ is_approved: !currentApproved }).eq('id', id);
    }
    addToast({
      title: !currentApproved ? 'Comment Approved' : 'Comment Unapproved',
      message: !currentApproved
        ? 'The comment is now publicly visible on the blog post.'
        : 'The comment has been hidden from the public blog.',
      type: 'success',
    });
  };

  const handleDelete = async (id: string, author: string) => {
    if (!window.confirm(`Delete comment by ${author}?`)) return;

    deleteComment(id);
    if (isSupabaseConfigured()) {
      await supabase.from('comments').delete().eq('id', id);
    }
    addToast({
      title: 'Comment Deleted',
      message: 'Comment permanently removed.',
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyber-neon" />
          <span>Blog Comment Moderation</span>
        </h2>
        <p className="text-xs text-gray-400">
          Review user responses before they appear publicly on your articles.
        </p>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-sm text-gray-400 font-mono">No comments to moderate.</p>
          </div>
        ) : (
          comments.map((comment) => {
            const relatedPost = posts.find((p) => p.id === comment.post_id);

            return (
              <div
                key={comment.id}
                className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 hover:border-cyber-accent/30 transition-all shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">
                        {comment.author_name}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">({comment.author_email})</span>
                      {comment.is_approved ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          APPROVED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          PENDING REVIEW
                        </span>
                      )}
                    </div>
                    {relatedPost && (
                      <div className="text-xs text-cyber-neon font-mono">
                        Article: {relatedPost.title}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(comment.id, comment.is_approved)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                        comment.is_approved
                          ? 'bg-dark-950 text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
                          : 'bg-cyber-accent text-dark-950 hover:bg-cyber-neon'
                      }`}
                    >
                      {comment.is_approved ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(comment.id, comment.author_name)}
                      className="p-1.5 rounded-lg bg-dark-950 text-gray-500 hover:text-red-400"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comment Content */}
                <p className="text-sm text-gray-300 leading-relaxed bg-dark-950/70 p-3 rounded-xl border border-white/5">
                  "{comment.comment_text}"
                </p>

                <div className="text-[11px] text-gray-500 font-mono">
                  Submitted: {formatDate(comment.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
