import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/redux';
import { useLoginMutation } from '../../store/api/timeoffApi';
import { setCredentials } from '../../store/slices/authSlice';
import { Button, Input, ErrorMessage } from '../../components/ui';
import type { UserRole } from '../../types';

const DEMO_ACCOUNTS = [
  { email: 'employee@example.com', label: 'Employee', role: 'EMPLOYEE' as UserRole },
  { email: 'manager@example.com', label: 'Manager', role: 'MANAGER' as UserRole },
  { email: 'admin@example.com', label: 'Admin', role: 'ADMIN' as UserRole },
];

const roleRedirects: Record<UserRole, string> = {
  EMPLOYEE: '/employee',
  MANAGER: '/manager',
  ADMIN: '/admin',
};

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await login({ email, password }).unwrap();
      dispatch(setCredentials({ user: result.user as any, accessToken: result.accessToken }));
      navigate(roleRedirects[result.user.role as UserRole] ?? '/');
    } catch (err: any) {
      setError(err?.data?.message || 'Login failed. Please try again.');
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 60%, #f0fdf4 100%)' }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 leading-none">ExampleHR</p>
            <p className="text-xs text-slate-400">Time-off Management</p>
          </div>
        </div>

        {/* Card */}
        <div className="card px-8 py-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <ErrorMessage message={error} />
            <Button type="submit" loading={isLoading} className="w-full mt-1">
              Sign in
            </Button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-4 card px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Demo accounts (password: password123)</p>
          <div className="flex gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc)}
                className="flex-1 py-2 px-3 rounded-[8px] text-xs font-medium border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
