import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { logout } from '../../store/slices/authSlice';

const navItems: Record<string, { to: string; label: string; icon: string; section?: string }[]> = {
  EMPLOYEE: [
    { to: '/employee', label: 'Dashboard', icon: '○' },
    { to: '/employee/requests', label: 'My Requests', icon: '○' },
    { to: '/employee/new-request', label: 'New Request', icon: '+' },
  ],
  MANAGER: [
    { to: '/manager', label: 'Team Overview', icon: '○', section: 'Team' },
    { to: '/manager/approvals', label: 'Pending Approvals', icon: '○', section: 'Team' },
    { to: '/manager/history', label: 'Request History', icon: '○', section: 'Team' },
    { to: '/employee', label: 'My Balance', icon: '○', section: 'My Leave' },
    { to: '/employee/requests', label: 'My Requests', icon: '○', section: 'My Leave' },
    { to: '/employee/new-request', label: 'New Request', icon: '+', section: 'My Leave' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: '○' },
    { to: '/admin/sync-logs', label: 'Sync Logs', icon: '○' },
    { to: '/admin/discrepancies', label: 'Discrepancies', icon: '○' },
    { to: '/admin/batch', label: 'Batch Import', icon: '○' },
  ],
};

export const AppShell: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);

  const items = user ? navItems[user.role] ?? [] : [];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-slate-200">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-none">ExampleHR</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Time-off</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Role label */}
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">
            {user?.role}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.reduce((acc: React.ReactNode[], item, idx) => {
              const prevSection = idx > 0 ? items[idx - 1].section : null;
              if (item.section && item.section !== prevSection) {
                acc.push(
                  <p key={`section-${item.section}`} className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 pt-3 pb-1">
                    {item.section}
                  </p>
                );
              }
              acc.push(
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.to.split('/').length <= 2}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm transition-all
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <span className="w-4 text-center opacity-50">{item.icon}</span>
                  {item.label}
                </NavLink>
              );
              return acc;
            }, [])}
          </div>
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-1.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
