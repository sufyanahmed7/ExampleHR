import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { EmployeeDashboard } from '../features/employee/EmployeeDashboard';
import { EmployeeRequests } from '../features/employee/EmployeeRequests';
import { NewRequestForm } from '../features/employee/NewRequestForm';
import { ManagerDashboard } from '../features/manager/ManagerDashboard';
import { ManagerApprovals } from '../features/manager/ManagerApprovals';
import { ManagerHistory } from '../features/manager/ManagerHistory';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { SyncLogsPage } from '../features/admin/SyncLogsPage';
import { DiscrepanciesPage } from '../features/admin/DiscrepanciesPage';
import { BatchImportPage } from '../features/admin/BatchImportPage';
import type { UserRole } from '../types';

// ── Guards ──────────────────────────────────────────────────────────────────

const RequireAuth: React.FC = () => {
  const { accessToken } = useAppSelector((s) => s.auth);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const RequireRole: React.FC<{ roles: UserRole[] }> = ({ roles }) => {
  const { user } = useAppSelector((s) => s.auth);
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
};

const RoleRedirect: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  if (!user) return <Navigate to="/login" replace />;
  const redirects: Record<UserRole, string> = {
    EMPLOYEE: '/employee',
    MANAGER: '/manager',
    ADMIN: '/admin',
  };
  return <Navigate to={redirects[user.role]} replace />;
};

// ── Router ──────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <RoleRedirect /> },

          // Employee routes
          {
            element: <RequireRole roles={['EMPLOYEE', 'MANAGER', 'ADMIN']} />,
            children: [
              { path: '/employee', element: <EmployeeDashboard /> },
              { path: '/employee/requests', element: <EmployeeRequests /> },
              { path: '/employee/new-request', element: <NewRequestForm /> },
            ],
          },

          // Manager routes
          {
            element: <RequireRole roles={['MANAGER', 'ADMIN']} />,
            children: [
              { path: '/manager', element: <ManagerDashboard /> },
              { path: '/manager/approvals', element: <ManagerApprovals /> },
              { path: '/manager/history', element: <ManagerHistory /> },
            ],
          },

          // Admin routes
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
              { path: '/admin/sync-logs', element: <SyncLogsPage /> },
              { path: '/admin/discrepancies', element: <DiscrepanciesPage /> },
              { path: '/admin/batch', element: <BatchImportPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
