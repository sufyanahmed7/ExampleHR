import React, { useState } from 'react';
import { format } from 'date-fns';
import { useListRequestsQuery } from '../../store/api/timeoffApi';
import { StatusBadge, Spinner, EmptyState, ErrorMessage, PageHeader, Select } from '../../components/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const ManagerHistory: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: requests, isLoading, error } = useListRequestsQuery(
    statusFilter ? { status: statusFilter as any } : undefined,
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Request History" subtitle="All team requests across all statuses" />

      <div className="flex items-center gap-3 mb-4">
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        />
        <span className="text-sm text-slate-400">{requests?.length ?? 0} requests</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorMessage message="Failed to load requests" />
      ) : !requests?.length ? (
        <EmptyState icon="🗂️" title="No requests found" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Employee', 'Type', 'Dates', 'Days', 'Submitted', 'Resolved', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.employeeId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.leaveType}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {format(new Date(r.startDate), 'MMM d')} – {format(new Date(r.endDate), 'MMM d, yy')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.daysRequested}d</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(r.submittedAt), 'MMM d, yy')}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.resolvedAt ? format(new Date(r.resolvedAt), 'MMM d, yy') : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
