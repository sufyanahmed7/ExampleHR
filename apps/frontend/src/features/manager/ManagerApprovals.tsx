import React, { useState } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useListRequestsQuery,
  useApproveRequestMutation,
  useRejectRequestMutation,
} from '../../store/api/timeoffApi';
import {
  Button, StatusBadge, Spinner, EmptyState, ErrorMessage, PageHeader, Modal, Input,
} from '../../components/ui';
import type { TimeOffRequest } from '../../types';

const rejectSchema = z.object({ reason: z.string().min(5, 'Please provide a reason (min 5 chars)') });
type RejectForm = z.infer<typeof rejectSchema>;

const RequestCard: React.FC<{
  request: TimeOffRequest;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}> = ({ request: r, onApprove, onReject, approving }) => (
  <div className="card px-5 py-5 animate-fade-in-up">
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-900">{r.leaveType}</span>
          <StatusBadge status={r.status} />
        </div>
        <p className="text-xs text-slate-400">
          Employee ID: <span className="font-mono text-slate-600">{r.employeeId.slice(0, 8)}…</span>
        </p>
      </div>
      <p className="text-xs text-slate-400">{format(new Date(r.submittedAt), 'MMM d, yyyy')}</p>
    </div>

    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="px-3 py-2.5 rounded-[8px] bg-slate-50">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Start</p>
        <p className="text-sm font-medium text-slate-900">{format(new Date(r.startDate), 'MMM d, yyyy')}</p>
      </div>
      <div className="px-3 py-2.5 rounded-[8px] bg-slate-50">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">End</p>
        <p className="text-sm font-medium text-slate-900">{format(new Date(r.endDate), 'MMM d, yyyy')}</p>
      </div>
      <div className="px-3 py-2.5 rounded-[8px] bg-indigo-50">
        <p className="text-[10px] text-indigo-400 uppercase tracking-wider mb-0.5">Days</p>
        <p className="text-sm font-bold text-indigo-700">{r.daysRequested}</p>
      </div>
    </div>

    {r.notes && (
      <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 mb-4">
        "{r.notes}"
      </p>
    )}

    {r.status === 'PENDING' && (
      <div className="flex gap-2">
        <Button size="sm" variant="danger" onClick={onReject}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          Reject
        </Button>
        <Button size="sm" onClick={onApprove} loading={approving}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          Approve
        </Button>
      </div>
    )}
  </div>
);

export const ManagerApprovals: React.FC = () => {
  const [rejectTarget, setRejectTarget] = useState<TimeOffRequest | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);

  const { data: requests, isLoading, error } = useListRequestsQuery({ status: 'PENDING' });
  const [approve, { isLoading: approving }] = useApproveRequestMutation();
  const [reject, { isLoading: rejecting }] = useRejectRequestMutation();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
  });

  const handleApprove = async (id: string) => {
    setApproveId(id);
    try {
      await approve(id).unwrap();
    } catch {
      // error shown via toast in real app; for now silently recovers
    } finally {
      setApproveId(null);
    }
  };

  const handleReject = async (data: RejectForm) => {
    if (!rejectTarget) return;
    await reject({ id: rejectTarget.id, reason: data.reason }).unwrap();
    reset();
    setRejectTarget(null);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Pending Approvals"
        subtitle="Review and action your team's requests"
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorMessage message="Failed to load requests" />
      ) : !requests?.length ? (
        <EmptyState
          icon="✅"
          title="All caught up!"
          description="No pending requests to review"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              onApprove={() => handleApprove(r.id)}
              onReject={() => setRejectTarget(r)}
              approving={approveId === r.id && approving}
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); reset(); }}
        title="Reject Request"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejectTarget(null); reset(); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSubmit(handleReject)} loading={rejecting}>
              Reject request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {rejectTarget && (
            <div className="px-4 py-3 rounded-[10px] bg-slate-50 border border-slate-200 text-sm">
              <p className="text-slate-700 font-medium">{rejectTarget.leaveType} · {rejectTarget.daysRequested} days</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {format(new Date(rejectTarget.startDate), 'MMM d')} – {format(new Date(rejectTarget.endDate), 'MMM d, yyyy')}
              </p>
            </div>
          )}
          <Input
            label="Reason for rejection"
            placeholder="Please provide a reason..."
            error={errors.reason?.message}
            {...register('reason')}
          />
        </div>
      </Modal>
    </div>
  );
};
