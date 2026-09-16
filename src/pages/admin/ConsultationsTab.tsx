import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Consultation } from '../../types';
import { Users, Mail, CheckCircle2, Clock, Trash2, Edit3, MessageSquareQuote } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

export const ConsultationsTab: React.FC = () => {
  const { consultations, updateConsultationStatus, deleteConsultation, addToast } = useStore();
  const [filter, setFilter] = useState<'all' | 'new' | 'contacted' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const filtered = filter === 'all'
    ? consultations
    : consultations.filter((c) => c.status === filter);

  const handleStatusChange = async (id: string, newStatus: Consultation['status']) => {
    updateConsultationStatus(id, newStatus);
    if (isSupabaseConfigured()) {
      await supabase.from('consultations').update({ status: newStatus }).eq('id', id);
    }
    addToast({
      title: 'Status Updated',
      message: `Lead status changed to ${newStatus}.`,
      type: 'success',
    });
  };

  const handleSaveNote = async (id: string) => {
    updateConsultationStatus(id, consultations.find((c) => c.id === id)?.status || 'contacted', noteText);
    if (isSupabaseConfigured()) {
      await supabase.from('consultations').update({ admin_notes: noteText }).eq('id', id);
    }
    setEditingId(null);
    addToast({
      title: 'Note Saved',
      message: 'Admin note updated successfully.',
      type: 'success',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete inquiry from ${name}?`)) return;

    deleteConsultation(id);
    if (isSupabaseConfigured()) {
      await supabase.from('consultations').delete().eq('id', id);
    }

    addToast({
      title: 'Inquiry Removed',
      message: `Consultation lead from ${name} deleted.`,
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <Users className="w-5 h-5 text-cyber-neon" />
            <span>Consultation & Lead Inbox</span>
          </h2>
          <p className="text-xs text-gray-400">
            Incoming prospective client inquiries submitted through the Consultation Drawer.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['all', 'new', 'contacted', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono capitalize transition-all ${
                filter === status
                  ? 'bg-cyber-accent text-dark-950 font-bold'
                  : 'bg-dark-900 text-gray-400 border border-white/10 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Consultations List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center space-y-2">
            <Users className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-sm text-gray-400 font-mono">No inquiries found for this filter.</p>
          </div>
        ) : (
          filtered.map((lead) => (
            <div
              key={lead.id}
              className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 hover:border-cyber-accent/30 transition-all shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-white font-mono">{lead.name}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        lead.status === 'new'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : lead.status === 'contacted'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {lead.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-cyber-neon hover:underline flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{lead.email}</span>
                    </a>
                    <span>•</span>
                    <span>Received: {formatDate(lead.created_at)}</span>
                  </div>
                </div>

                {/* Status Dropdown & Delete */}
                <div className="flex items-center gap-3">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      handleStatusChange(lead.id, e.target.value as Consultation['status'])
                    }
                    className="px-3 py-1.5 rounded-lg bg-dark-950 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-cyber-accent"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>

                  <button
                    onClick={() => handleDelete(lead.id, lead.name)}
                    className="p-1.5 rounded-lg bg-dark-950 text-gray-500 hover:text-red-400"
                    title="Delete lead"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Service Requested */}
              <div className="text-xs font-mono text-cyber-neon font-semibold bg-dark-950/70 p-2.5 rounded-xl border border-white/5 inline-block">
                Service Requested: {lead.service}
              </div>

              {/* Message */}
              <div className="p-4 rounded-xl bg-dark-950 border border-white/5 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {lead.message}
              </div>

              {/* Admin Internal Notes */}
              <div className="pt-2 border-t border-white/5">
                {editingId === lead.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add follow-up notes, call schedule, or quotation amount..."
                      className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-cyber-accent/40 text-xs text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-white font-mono"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveNote(lead.id)}
                        className="px-3 py-1 rounded-lg bg-cyber-accent text-dark-950 text-xs font-mono font-bold hover:bg-cyber-neon"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
                    <div>
                      <span className="text-gray-500">Internal Note: </span>
                      <span>{lead.admin_notes || 'No note added yet.'}</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(lead.id);
                        setNoteText(lead.admin_notes || '');
                      }}
                      className="text-cyber-neon hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{lead.admin_notes ? 'Edit' : 'Add Note'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
