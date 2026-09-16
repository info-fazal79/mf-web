import React from 'react';
import { useStore } from '../../store/useStore';
import { formatPrice, formatDate } from '../../lib/utils';
import { 
  BookOpen, 
  FolderGit2, 
  FileText, 
  MessageSquare, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export const OverviewTab: React.FC = () => {
  const { 
    books, 
    projects, 
    posts, 
    consultations, 
    orders, 
    comments 
  } = useStore();

  const totalRevenue = orders.reduce((acc, order) => acc + (order.amount || 0), 0);
  const pendingConsultations = consultations.filter((c) => c.status === 'new').length;

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatPrice(totalRevenue),
      subtext: `${orders.length} orders recorded`,
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/20 text-emerald-400',
    },
    {
      title: 'Digital eBooks',
      value: books.length.toString(),
      subtext: `${books.filter(b => b.is_free).length} free guides`,
      icon: <BookOpen className="w-5 h-5 text-cyber-neon" />,
      color: 'border-cyber-accent/20 text-cyber-neon',
    },
    {
      title: 'Active Projects',
      value: projects.length.toString(),
      subtext: 'Portfolio showcases',
      icon: <FolderGit2 className="w-5 h-5 text-blue-400" />,
      color: 'border-blue-500/20 text-blue-400',
    },
    {
      title: 'Articles Published',
      value: posts.length.toString(),
      subtext: `${comments.length} total comments`,
      icon: <FileText className="w-5 h-5 text-purple-400" />,
      color: 'border-purple-500/20 text-purple-400',
    },
    {
      title: 'Consultation Inquiries',
      value: consultations.length.toString(),
      subtext: `${pendingConsultations} new inquiries pending`,
      icon: <Users className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/20 text-amber-400',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-cyber-accent/20 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-cyber-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-dim text-cyber-neon text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FAZAL Command Center</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
            Welcome to Your Admin Workspace
          </h2>
          <p className="text-sm text-gray-300 max-w-2xl">
            Monitor real-time eBook sales, moderate community comments, update featured projects, and manage high-value consultation leads.
          </p>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl bg-dark-900 border ${stat.color} shadow-lg space-y-3 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400">{stat.title}</span>
              <div className="p-2 rounded-xl bg-dark-950 border border-white/5">
                {stat.icon}
              </div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-white font-mono">{stat.value}</div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">{stat.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Section: Recent Orders & Recent Consultation Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-cyber-neon" />
              <span>Recent eCommerce Orders</span>
            </h3>
            <span className="text-xs font-mono text-gray-500">
              {orders.length} total orders
            </span>
          </div>

          <div className="divide-y divide-white/5 overflow-x-auto">
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No orders placed yet.</p>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div key={order.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white font-mono">
                      {order.customer_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {order.book?.title || 'eBook Digital Purchase'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                      {order.payment_method.toUpperCase()} • {formatDate(order.created_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-cyber-neon">
                      {formatPrice(order.amount)}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold mt-1 ${
                        order.status === 'completed' || order.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Consultation Inquiries */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-cyber-neon" />
              <span>Incoming Consultation Leads</span>
            </h3>
            <span className="text-xs font-mono text-gray-500">
              {consultations.length} leads
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {consultations.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No inquiries received yet.</p>
            ) : (
              consultations.slice(0, 5).map((lead) => (
                <div key={lead.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white font-mono">
                      {lead.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        lead.status === 'new'
                          ? 'bg-red-500/20 text-red-400'
                          : lead.status === 'contacted'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {lead.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-cyber-neon font-mono">{lead.service}</div>
                  <p className="text-xs text-gray-300 line-clamp-1">{lead.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
