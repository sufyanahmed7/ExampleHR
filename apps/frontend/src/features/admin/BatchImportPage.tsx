import React, { useState } from 'react';
import { useIngestBatchMutation } from '../../store/api/timeoffApi';
import { Button, ErrorMessage, PageHeader } from '../../components/ui';

const SAMPLE = JSON.stringify(
  {
    records: [
      { employeeId: 'emp-001', locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 20, usedDays: 3 },
      { employeeId: 'emp-001', locationId: 'LOC-001', leaveType: 'SICK', totalDays: 10, usedDays: 0 },
    ],
  },
  null,
  2,
);

export const BatchImportPage: React.FC = () => {
  const [raw, setRaw] = useState(SAMPLE);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [ingestBatch, { isLoading }] = useIngestBatchMutation();

  const handleImport = async () => {
    setParseError('');
    setResult(null);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setParseError('Invalid JSON — please check the format');
      return;
    }
    if (!parsed.records || !Array.isArray(parsed.records)) {
      setParseError('JSON must have a top-level "records" array');
      return;
    }
    try {
      const res = await ingestBatch({ records: parsed.records }).unwrap();
      setResult(res);
    } catch (err: any) {
      setParseError(err?.data?.message || 'Import failed');
    }
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <PageHeader
        title="Batch Import"
        subtitle="Paste a full HCM balance corpus to sync all employees at once"
      />

      <div className="card px-6 py-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-700">Payload JSON</label>
          <button
            onClick={() => setRaw(SAMPLE)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Load sample
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setParseError(''); setResult(null); }}
          className="w-full h-64 px-3 py-2.5 font-mono text-xs rounded-[10px] border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          spellCheck={false}
        />
        <ErrorMessage message={parseError} />
      </div>

      {result && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-[10px] bg-green-50 border border-green-200 text-sm text-green-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          Import successful — {result.recordsUpdated ?? '?'} records updated
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleImport} loading={isLoading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          Run Import
        </Button>
        <Button variant="secondary" onClick={() => { setRaw(''); setResult(null); setParseError(''); }}>
          Clear
        </Button>
      </div>

      <div className="mt-6 card px-5 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Record schema</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              {['Field', 'Type', 'Required', 'Notes'].map((h) => (
                <th key={h} className="text-left py-1.5 pr-4 font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ['employeeId', 'string', '✓', 'Internal employee UUID'],
              ['locationId', 'string', '✓', 'e.g. LOC-001'],
              ['leaveType', 'string', '✓', 'ANNUAL, SICK, etc.'],
              ['totalDays', 'number', '✓', '≥ 0'],
              ['usedDays', 'number', '✓', '≥ 0, ≤ totalDays'],
            ].map(([f, t, r, n]) => (
              <tr key={f} className="border-b border-slate-50">
                <td className="py-1.5 pr-4 font-mono text-indigo-700">{f}</td>
                <td className="py-1.5 pr-4 font-mono text-slate-500">{t}</td>
                <td className="py-1.5 pr-4 text-green-700">{r}</td>
                <td className="py-1.5 text-slate-400">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
