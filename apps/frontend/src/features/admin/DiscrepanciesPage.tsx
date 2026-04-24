import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useGetDiscrepanciesQuery, useTriggerReconcileMutation } from '../../store/api/timeoffApi';
import { Button, Spinner, EmptyState, ErrorMessage, PageHeader } from '../../components/ui';

export const DiscrepanciesPage: React.FC = () => {
  const { data: discrepancies, isLoading, error, refetch } = useGetDiscrepanciesQuery();
  const [reconcile, { isLoading: reconciling }] = useTriggerReconcileMutation();

  const handleReconcile = async () => {
    await reconcile().unwrap();
    refetch();
  };

  const staleness = (ms: number) => {
    if (ms > 3_600_000) return { label: 'Critical', color: 'text-red-600 bg-red-50' };
    if (ms > 1_800_000) return { label: 'Stale', color: 'text-amber-600 bg-amber-50' };
    return { label: 'Recent', color: 'text-slate-500 bg-slate-100' };
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Discrepancies"
        subtitle="Balances that are stale or out of sync with HCM"
        action={
          <Button onClick={handleReconcile} loading={reconciling}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
            Reconcile All
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorMessage message="Failed to load discrepancies" />
      ) : !discrepancies?.length ? (
        <EmptyState
          icon="✅"
          title="No discrepancies found"
          description="All balances are in sync with HCM"
        />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-[10px] bg-amber-50 border border-amber-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            <p className="text-sm text-amber-800 font-medium">
              {discrepancies.length} balance{discrepancies.length !== 1 ? 's' : ''} need reconciliation
            </p>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Location', 'Leave Type', 'Total', 'Used', 'Last Synced', 'Age'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {discrepancies.map((d, i) => {
                  const s = staleness(d.staleSinceMs);
                  return (
                    <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{d.employeeId.slice(0, 8)}…</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{d.locationId}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{d.leaveType}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{d.localTotalDays}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{d.localUsedDays}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {d.lastSyncedAt
                          ? formatDistanceToNow(new Date(d.lastSyncedAt), { addSuffix: true })
                          : 'Never'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
