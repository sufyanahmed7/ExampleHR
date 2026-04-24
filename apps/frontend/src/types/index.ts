// User & Auth
export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationId: string;
  managerId: string | null;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Balance
export interface Balance {
  id: string;
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
  lastSyncedAt: string | null;
  version: number;
}

// Time-off request
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  locationId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: RequestStatus;
  managerId: string | null;
  notes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  hcmReferenceId: string | null;
}

// Sync / Admin
export type SyncType = 'REALTIME' | 'BATCH' | 'RECONCILE';
export type SyncStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface SyncLog {
  id: string;
  syncType: SyncType;
  status: SyncStatus;
  recordsProcessed: number;
  recordsUpdated: number;
  discrepanciesFound: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface SyncStats {
  totalSyncs: number;
  successRate: number;
  lastBatchAt: string | null;
  lastReconcileAt: string | null;
  staleBalanceCount: number;
}

export interface Discrepancy {
  employeeId: string;
  locationId: string;
  leaveType: string;
  localTotalDays: number;
  localUsedDays: number;
  lastSyncedAt: string | null;
  staleSinceMs: number;
}

// API error shape
export interface ApiError {
  statusCode: number;
  message: string;
  errors?: string[];
}
