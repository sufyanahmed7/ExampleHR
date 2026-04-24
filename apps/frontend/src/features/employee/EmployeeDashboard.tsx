import React from 'react';
import { Link } from 'react-router-dom';
import { useGetMyBalancesQuery, useListRequestsQuery } from '../../store/api/timeoffApi';
import { Spinner, StatusBadge, Button, ErrorMessage, EmptyState, PageHeader } from '../../components/ui';
import { useAppSelector } from '../../hooks/redux';
import { format } from 'date-fns';

const BalanceCard: React.FC<{ leaveType: string; total: number; used: number; pending: number; available: number }> = ({
  leaveType, total, used, pending, available,
}) => {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const colorMap: Record<string, string> = {
    ANNUAL: '#6366f1',
    SICK: '#10b981',
    PERSONAL: '#f59e0b',
    MATERNITY: '#ec4899',
    PATERNITY: '#3b82f6',
  };
  const color = colorMap[leaveType] ?? '#8b5cf6';

  return (
    <div className="card px-5 py-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{leaveType}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{available}<span className="text-base font-normal text-slate-400">/{total}</span></p>
          <p className="text-xs text-slate-500 mt-0.5">days available</p>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${color}15` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>{used} used</span>
        {pending > 0 && <span className="text-amber-500">{pending} pending</span>}
        <span>{pct}% remaining</span>
      </div>
    </div>
  );
};

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const { data: balances, isLoading: bLoading, error: bError } = useGetMyBalancesQuery();
  const { data: requests, isLoading: rLoading } = useListRequestsQuery({ status: 'PENDING' });

  const recentRequests = requests?.slice(0, 5) ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`Good morning, ${user?.firstName} 👋`}
        subtitle="Here's your leave overview"
        action={
          <Link to="/employee/new-request">
            <Button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              New request
            </Button>
          </Link>
        }
      />

      {/* Balances */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Leave Balances</h2>
        {bLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : bError ? (
          <ErrorMessage message="Failed to load balances" />
        ) : balances?.length === 0 ? (
          <EmptyState icon="📊" title="No balances found" description="Contact your admin to set up your leave balances" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances?.map((b) => (
              <BalanceCard
                key={b.id}
                leaveType={b.leaveType}
                total={b.totalDays}
                used={b.usedDays}
                pending={b.pendingDays}
                available={b.availableDays}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pending Requests</h2>
          <Link to="/employee/requests" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all →</Link>
        </div>
        {rLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : recentRequests.length === 0 ? (
          <div className="card px-6 py-8 text-center">
            <p className="text-slate-400 text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dates</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Days</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{r.leaveType}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {format(new Date(r.startDate), 'MMM d')} – {format(new Date(r.endDate), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{r.daysRequested}d</td>
                    <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
