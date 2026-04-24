import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { differenceInBusinessDays, parseISO, isWeekend } from 'date-fns';
import { useCreateRequestMutation, useGetMyBalancesQuery } from '../../store/api/timeoffApi';
import { Button, Input, Select, ErrorMessage, PageHeader } from '../../components/ui';

const today = new Date().toISOString().split('T')[0];

const schema = z
  .object({
    leaveType: z.string().min(1, 'Leave type is required'),
    startDate: z.string().min(1, 'Start date is required').refine((d) => d >= today, {
      message: 'Start date cannot be in the past',
    }),
    endDate: z.string().min(1, 'End date is required'),
    daysRequested: z.number({ invalid_type_error: 'Must be a number' }).min(0.5).max(365),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

type FormValues = z.infer<typeof schema>;

export const NewRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const [createRequest, { isLoading }] = useCreateRequestMutation();
  const { data: balances } = useGetMyBalancesQuery();
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { leaveType: 'ANNUAL', daysRequested: 1 },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const leaveType = watch('leaveType');

  // Auto-calculate business days when dates change
  React.useEffect(() => {
    if (startDate && endDate && endDate >= startDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      let days = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (!isWeekend(cur)) days += 1;
        cur.setDate(cur.getDate() + 1);
      }
      if (days > 0) setValue('daysRequested', days);
    }
  }, [startDate, endDate, setValue]);

  const selectedBalance = balances?.find((b) => b.leaveType === leaveType);

  const leaveTypeOptions = balances?.length
    ? balances.map((b) => ({ value: b.leaveType, label: `${b.leaveType} (${b.availableDays} days available)` }))
    : [{ value: 'ANNUAL', label: 'ANNUAL' }, { value: 'SICK', label: 'SICK' }];

  const onSubmit = async (data: FormValues) => {
    setApiError('');
    try {
      await createRequest(data).unwrap();
      navigate('/employee/requests');
    } catch (err: any) {
      setApiError(err?.data?.message || 'Failed to submit request');
    }
  };

  return (
    <div className="animate-fade-in-up max-w-xl">
      <PageHeader
        title="New Time-off Request"
        subtitle="Submit a request for your manager's approval"
      />

      {/* Balance hint */}
      {selectedBalance && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-[10px] bg-indigo-50 border border-indigo-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <p className="text-sm text-indigo-700">
            <span className="font-semibold">{selectedBalance.availableDays} days</span> available for {leaveType}
            {selectedBalance.pendingDays > 0 && (
              <span className="text-indigo-500"> · {selectedBalance.pendingDays} pending</span>
            )}
          </p>
        </div>
      )}

      <div className="card px-6 py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Select
            label="Leave Type"
            options={leaveTypeOptions}
            error={errors.leaveType?.message}
            {...register('leaveType')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              min={today}
              error={errors.startDate?.message}
              {...register('startDate')}
            />
            <Input
              label="End Date"
              type="date"
              min={startDate || today}
              error={errors.endDate?.message}
              {...register('endDate')}
            />
          </div>

          <div>
            <Input
              label="Days Requested"
              type="number"
              step="0.5"
              min="0.5"
              hint="Auto-calculated from date range (excluding weekends)"
              error={errors.daysRequested?.message}
              {...register('daysRequested', { valueAsNumber: true })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              className="px-3 py-2.5 rounded-[10px] border border-slate-200 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300 resize-none"
              rows={3}
              placeholder="Add any context for your manager..."
              maxLength={500}
              {...register('notes')}
            />
            {errors.notes && <p className="text-xs text-red-600">{errors.notes.message}</p>}
          </div>

          <ErrorMessage message={apiError} />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
