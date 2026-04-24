import React from 'react';
import { Link } from 'react-router-dom';
import { useListRequestsQuery } from '../../store/api/timeoffApi';
import { StatusBadge, Spinner, EmptyState, PageHeader, Button, StatCard } from '../../components/ui';
import { format } from 'date-fns';

export const ManagerDashboard: React.FC = () => {
  const { data: all, isLoading } = useListRequestsQuery();
  const pending = all?.filter((r) => r.status === 'PENDING') ?? [];
  const approved = all?.filter((r) => r.status === 'APPROVED') ?? [];
  const rejected = all?.filter((r) => r.status === 'REJECTED') ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Team Overview"
        subtitle="Monitor your team's leave requests"
        action={
          <Link to="/manager/approvals">
            <Button>
              Review Pending
              {pending.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs font-bold">
                  {pending.length}
                </span>
              )}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending" value={pending.length} color={pending.length > 0 ? 'text-amber-600' : 'text-slate-900'} sub="Awaiting review" />
        <StatCard label="Approved (total)" value={approved.length} color="text-green-700" sub="All time" />
        <StatCard label="Rejected" value={rejected.length} sub="All time" />
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Pending Requests</h2>
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : pending.length === 0 ? (
        <EmptyState icon="✅" title="No pending requests" description="Your team has no outstanding requests" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Employee', 'Type', 'Dates', 'Days', 'Submitted', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{r.employeeId.slice(0, 8)}…</td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.leaveType}</td>
                  <td className="px-5 py-3.5 text-slate-600 text-xs">
                    {format(new Date(r.startDate), 'MMM d')} – {format(new Date(r.endDate), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-medium">{r.daysRequested}d</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{format(new Date(r.submittedAt), 'MMM d')}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3.5">
                    <Link to="/manager/approvals" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Review →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
