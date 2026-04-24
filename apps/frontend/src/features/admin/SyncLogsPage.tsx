import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useGetSyncLogsQuery } from '../../store/api/timeoffApi';
import { Spinner, EmptyState, ErrorMessage, PageHeader } from '../../components/ui';

const dot = (status: string) => {
  const c: Record<string, string> = { SUCCESS: 'bg-green-500', FAILED: 'bg-red-500', PARTIAL: 'bg-amber-500' };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[status] ?? 'bg-slate-400'} mr-1.5`} />;
};

export const SyncLogsPage: React.FC = () => {
  const [limit, setLimit] = useState(50);
  const { data: logs, isLoading, error, refetch } = useGetSyncLogsQuery({ limit });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Sync Logs"
        subtitle="Complete HCM synchronisation history"
        action={
          <button onClick={() => refetch()} className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorMessage message="Failed to load sync logs" />
      ) : !logs?.length ? (
        <EmptyState icon="🔄" title="No sync logs yet" description="Sync activity will appear here" />
      ) : (
        <>
          <div className="card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Status', 'Type', 'Processed', 'Updated', 'Discrepancies', 'Error', 'When'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className="flex items-center text-xs font-medium text-slate-700">
                        {dot(l.status)}{l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{l.syncType}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{l.recordsProcessed}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{l.recordsUpdated}</td>
                    <td className="px-5 py-3 text-xs">
                      <span className={l.discrepanciesFound > 0 ? 'text-red-600 font-semibold' : 'text-slate-300'}>
                        {l.discrepanciesFound}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-red-500 max-w-[160px] truncate" title={l.errorMessage ?? ''}>
                      {l.errorMessage ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400" title={format(new Date(l.createdAt), 'PPpp')}>
                      {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length >= limit && (
            <div className="flex justify-center">
              <button
                onClick={() => setLimit((l) => l + 50)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
