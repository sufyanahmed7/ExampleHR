import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useListRequestsQuery, useCancelRequestMutation } from '../../store/api/timeoffApi';
import {
  Button, StatusBadge, Spinner, EmptyState, ErrorMessage, PageHeader, Select, Modal,
} from '../../components/ui';
import type { RequestStatus } from '../../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const EmployeeRequests: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: requests, isLoading, error, refetch } = useListRequestsQuery(
    statusFilter ? { status: statusFilter as RequestStatus } : undefined,
  );
  const [cancelRequest, { isLoading: cancelling }] = useCancelRequestMutation();

  const handleCancel = async () => {
    if (!cancelId) return;
    await cancelRequest(cancelId).unwrap();
    setCancelId(null);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="My Requests"
        subtitle="Track all your time-off requests"
        action={
          <Link to="/employee/new-request">
            <Button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              New request
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        />
        <button
          onClick={() => refetch()}
          className="h-10 w-10 flex items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorMessage message="Failed to load requests" />
      ) : !requests?.length ? (
        <EmptyState
          icon="🗓️"
          title="No requests found"
          description="Submit your first time-off request"
          action={<Link to="/employee/new-request"><Button>New request</Button></Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Type', 'Dates', 'Days', 'Submitted', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.leaveType}</td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {format(new Date(r.startDate), 'MMM d')} – {format(new Date(r.endDate), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{r.daysRequested}d</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {format(new Date(r.submittedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => setCancelId(r.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <span className="text-xs text-slate-400 italic" title={r.rejectionReason}>
                        Reason on file
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel confirm modal */}
      <Modal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel Request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelId(null)}>Keep it</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Yes, cancel request
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to cancel this request? This action will release the pending days
          back to your balance.
        </p>
      </Modal>
    </div>
  );
};
