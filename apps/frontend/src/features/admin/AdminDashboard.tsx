import React from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useGetSyncStatsQuery,
  useGetDiscrepanciesQuery,
  useTriggerReconcileMutation,
  useGetSyncLogsQuery,
} from '../../store/api/timeoffApi';
import { Button, Spinner, PageHeader, StatCard, ErrorMessage } from '../../components/ui';

const SyncStatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    SUCCESS: 'bg-green-500',
    FAILED: 'bg-red-500',
    PARTIAL: 'bg-amber-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-slate-400'}`} />;
};

export const AdminDashboard: React.FC = () => {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetSyncStatsQuery();
  const { data: discrepancies } = useGetDiscrepanciesQuery();
  const { data: recentLogs } = useGetSyncLogsQuery({ limit: 5 });
  const [reconcile, { isLoading: reconciling }] = useTriggerReconcileMutation();

  const handleReconcile = async () => {
    await reconcile().unwrap();
    refetchStats();
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Admin Dashboard"
        subtitle="HCM sync health and balance management"
        action={
          <Button onClick={handleReconcile} loading={reconciling} variant="secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
            Reconcile Now
          </Button>
        }
      />

      {/* Stats grid */}
      {statsLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Syncs"
            value={stats?.totalSyncs ?? 0}
            sub="All time"
          />
          <StatCard
            label="Success Rate"
            value={`${stats?.successRate ?? 0}%`}
            color={
              (stats?.successRate ?? 0) >= 95 ? 'text-green-700'
                : (stats?.successRate ?? 0) >= 80 ? 'text-amber-600'
                  : 'text-red-700'
            }
            sub="HCM sync reliability"
          />
          <StatCard
            label="Stale Balances"
            value={stats?.staleBalanceCount ?? 0}
            color={(stats?.staleBalanceCount ?? 0) > 0 ? 'text-amber-600' : 'text-green-700'}
            sub=">30 min since sync"
          />
          <StatCard
            label="Discrepancies"
            value={discrepancies?.length ?? 0}
            color={(discrepancies?.length ?? 0) > 0 ? 'text-red-700' : 'text-green-700'}
            sub="Needs reconcile"
          />
        </div>
      )}

      {/* Last sync timestamps */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Last Batch Sync</p>
          {stats?.lastBatchAt ? (
            <>
              <p className="text-sm font-medium text-slate-900">{format(new Date(stats.lastBatchAt), 'MMM d, yyyy HH:mm')}</p>
              <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(stats.lastBatchAt), { addSuffix: true })}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Never</p>
          )}
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Last Reconcile</p>
          {stats?.lastReconcileAt ? (
            <>
              <p className="text-sm font-medium text-slate-900">{format(new Date(stats.lastReconcileAt), 'MMM d, yyyy HH:mm')}</p>
              <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(stats.lastReconcileAt), { addSuffix: true })}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Never</p>
          )}
        </div>
      </div>

      {/* Recent sync logs */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Sync Activity</h2>
        <Link to="/admin/sync-logs" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all →</Link>
      </div>
      <div className="card overflow-hidden mb-6">
        {!recentLogs?.length ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No sync activity yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Status', 'Type', 'Records', 'Updated', 'Discrepancies', 'Time'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      <SyncStatusDot status={l.status} />
                      <span className="text-xs font-medium text-slate-700">{l.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-600">{l.syncType}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{l.recordsProcessed}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{l.recordsUpdated}</td>
                  <td className="px-5 py-3 text-xs">
                    <span className={l.discrepanciesFound > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                      {l.discrepanciesFound}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { to: '/admin/sync-logs', label: 'Sync Logs', desc: 'Full history of HCM sync events', icon: '🔄' },
          { to: '/admin/discrepancies', label: 'Discrepancies', desc: 'Stale or mismatched balances', icon: '⚠️' },
          { to: '/admin/batch', label: 'Batch Import', desc: 'Ingest HCM balance corpus', icon: '📥' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{item.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};
