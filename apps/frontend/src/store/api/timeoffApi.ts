import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store/store';
import type {
  Balance, TimeOffRequest, SyncLog, SyncStats, Discrepancy, User,
} from '../../types';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Balance', 'Request', 'SyncLog', 'SyncStats', 'Discrepancy'],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation<{ accessToken: string; user: User }, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
    }),

    // Balances
    getMyBalances: builder.query<Balance[], void>({
      query: () => '/balances/me',
      providesTags: ['Balance'],
    }),
    getBalances: builder.query<Balance[], { employeeId: string; locationId: string }>({
      query: ({ employeeId, locationId }) => `/balances/${employeeId}/${locationId}`,
      providesTags: ['Balance'],
    }),
    syncEmployee: builder.mutation<Balance[], { employeeId: string; locationId: string }>({
      query: ({ employeeId, locationId }) => ({
        url: `/balances/sync/employee/${employeeId}/${locationId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Balance'],
    }),
    ingestBatch: builder.mutation<unknown, { records: Omit<Balance, 'id' | 'pendingDays' | 'availableDays' | 'version' | 'lastSyncedAt'>[] }>({
      query: (body) => ({ url: '/balances/sync/batch', method: 'POST', body }),
      invalidatesTags: ['Balance', 'SyncLog', 'SyncStats'],
    }),

    // Requests
    createRequest: builder.mutation<TimeOffRequest, { leaveType: string; startDate: string; endDate: string; daysRequested: number; notes?: string }>({
      query: (body) => ({ url: '/requests', method: 'POST', body }),
      invalidatesTags: ['Request', 'Balance'],
    }),
    listRequests: builder.query<TimeOffRequest[], { employeeId?: string; status?: string; fromDate?: string; toDate?: string } | void>({
      query: (params) => ({ url: '/requests', params: params ?? {} }),
      providesTags: ['Request'],
    }),
    getRequest: builder.query<TimeOffRequest, string>({
      query: (id) => `/requests/${id}`,
      providesTags: ['Request'],
    }),
    approveRequest: builder.mutation<TimeOffRequest, string>({
      query: (id) => ({ url: `/requests/${id}/approve`, method: 'PATCH' }),
      invalidatesTags: ['Request', 'Balance'],
    }),
    rejectRequest: builder.mutation<TimeOffRequest, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/requests/${id}/reject`, method: 'PATCH', body: { reason } }),
      invalidatesTags: ['Request', 'Balance'],
    }),
    cancelRequest: builder.mutation<TimeOffRequest, string>({
      query: (id) => ({ url: `/requests/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Request', 'Balance'],
    }),

    // Admin
    getSyncLogs: builder.query<SyncLog[], { limit?: number } | void>({
      query: (params) => ({ url: '/admin/sync-logs', params: params ?? {} }),
      providesTags: ['SyncLog'],
    }),
    getSyncStats: builder.query<SyncStats, void>({
      query: () => '/admin/stats',
      providesTags: ['SyncStats'],
    }),
    getDiscrepancies: builder.query<Discrepancy[], void>({
      query: () => '/admin/discrepancies',
      providesTags: ['Discrepancy'],
    }),
    triggerReconcile: builder.mutation<{ discrepancies: number; triggeredAt: string }, void>({
      query: () => ({ url: '/admin/reconcile', method: 'POST' }),
      invalidatesTags: ['SyncLog', 'SyncStats', 'Discrepancy', 'Balance'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useGetMyBalancesQuery,
  useGetBalancesQuery,
  useSyncEmployeeMutation,
  useIngestBatchMutation,
  useCreateRequestMutation,
  useListRequestsQuery,
  useGetRequestQuery,
  useApproveRequestMutation,
  useRejectRequestMutation,
  useCancelRequestMutation,
  useGetSyncLogsQuery,
  useGetSyncStatsQuery,
  useGetDiscrepanciesQuery,
  useTriggerReconcileMutation,
} = api;
